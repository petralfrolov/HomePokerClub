"""
Poker App — FastAPI main entry point.
"""

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import CORS_ORIGINS, AVATARS_DIR, PLAYER_AVATARS_DIR, APP_VERSION, DATABASE_URL
from backend.config import IDLE_TABLE_CLEANUP_INTERVAL, IDLE_TABLE_TIMEOUT_MINUTES

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
from backend.database import init_db
from backend.routers import lobby, tables, players
from backend.ws.manager import manager as ws_manager
from backend.services.game_engine import game_engine

# Import models for recovery
from sqlalchemy import select
from backend.database import async_session
from backend.models.tables import Table, Player


IDLE_TABLE_TIMEOUT = timedelta(minutes=IDLE_TABLE_TIMEOUT_MINUTES)


async def _cleanup_idle_tables():
    """Background task: delete tables with no activity for IDLE_TABLE_TIMEOUT."""
    from backend.models.tables import GameRound, RoundAction
    from sqlalchemy import delete as sa_delete

    while True:
        await asyncio.sleep(IDLE_TABLE_CLEANUP_INTERVAL)
        now = datetime.now(timezone.utc)
        stale_ids = [
            table_id
            for table_id, game in list(game_engine.games.items())
            if (now - game.last_activity_at) >= IDLE_TABLE_TIMEOUT
        ]
        if not stale_ids:
            continue

        async with async_session() as db:
            for table_id in stale_ids:
                try:
                    # Notify connected clients before dropping them
                    await ws_manager.broadcast_all(table_id, "table_deleted", {
                        "reason": "idle_timeout"
                    })

                    # Delete RoundActions → GameRounds → Players → Table
                    rounds_result = await db.execute(
                        select(GameRound).where(GameRound.table_id == table_id)
                    )
                    for r in rounds_result.scalars().all():
                        await db.execute(
                            sa_delete(RoundAction).where(RoundAction.round_id == r.id)
                        )
                        await db.delete(r)

                    await db.execute(
                        sa_delete(Player).where(Player.table_id == table_id)
                    )

                    tbl = await db.get(Table, table_id)
                    if tbl:
                        await db.delete(tbl)

                    await db.commit()
                    game_engine.remove_game(table_id)
                    logger.info("Deleted idle table %s (no activity for 60 min)", table_id)
                except Exception:
                    logger.exception("Error cleaning up idle table %s", table_id)
                    await db.rollback()





logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("poker")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    PLAYER_AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Recover active games from DB to in-memory engine
    async with async_session() as db:
        result = await db.execute(select(Table))
        tables_list = result.scalars().all()
        for t in tables_list:
            # Create in-memory state
            game = game_engine.create_game(
                table_id=t.id,
                game_type=t.type,
                blind_small=t.blind_small,
                blind_big=t.blind_big,
                time_per_move=t.time_per_move,
                time_bank_max=t.time_bank_max,
                dealer_type=t.dealer_type,
                tournament_blind_interval=t.tournament_blind_interval,
                tournament_blind_multiplier=t.tournament_blind_multiplier or 1.5,
            )
            # Restore table-level game state from DB
            game.round_number = t.round_number
            game.dealer_seat_index = t.dealer_seat_index
            # Add existing players
            p_result = await db.execute(select(Player).where(Player.table_id == t.id))
            players_list = p_result.scalars().all()
            from backend.services.game_engine import PlayerState
            for p in players_list:
                game_engine.add_player(
                    t.id,
                    PlayerState(
                        player_id=p.id,
                        session_id=p.session_id,
                        nickname=p.nickname,
                        seat_index=p.seat_index,
                        stack=p.stack,
                        time_bank=p.time_bank,
                        total_buyin=p.stack,
                        avatar_url=p.avatar_url,
                    )
                )
    
    logger.info("Poker server started and games recovered from DB")
    cleanup_task = asyncio.create_task(_cleanup_idle_tables())
    ws_maintenance_task = asyncio.create_task(ws_manager.run_maintenance_loop())
    yield
    # Shutdown
    cleanup_task.cancel()
    ws_maintenance_task.cancel()
    logger.info("Poker server shutting down")


app = FastAPI(title="Home Poker Club", version=APP_VERSION, lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/static/dealer_avatars", StaticFiles(directory=str(AVATARS_DIR)), name="dealer_avatars")
app.mount("/static/player_avatars", StaticFiles(directory=str(PLAYER_AVATARS_DIR)), name="player_avatars")

# Routers
app.include_router(lobby.router)
app.include_router(tables.router)
app.include_router(players.router)


# Health check
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": APP_VERSION}


# WebSocket endpoint
@app.websocket("/ws/{table_id}")
async def websocket_endpoint(websocket: WebSocket, table_id: str, session_id: str = ""):
    if not session_id:
        await websocket.close(code=4001, reason="session_id required")
        return

    try:
        uuid.UUID(session_id, version=4)
    except (ValueError, AttributeError):
        await websocket.close(code=4002, reason="Invalid session_id format")
        return

    await ws_manager.connect(table_id, session_id, websocket)

    # Send initial game state
    game = game_engine.get_game(table_id)
    if game:
        snapshot = game_engine.get_game_snapshot(game, for_session_id=session_id)
        await ws_manager.send_personal(table_id, session_id, "game_state", snapshot)

    try:
        while True:
            data = await websocket.receive_text()
            # Any frame from the client is a liveness signal.
            ws_manager.touch(table_id, session_id)
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")
            # Handle ping/pong keepalive (both directions)
            if msg_type == "ping":
                try:
                    await websocket.send_text(json.dumps({"type": "pong"}))
                except Exception:
                    break
            # "pong" from client in response to server ping: already touched above.

    except WebSocketDisconnect:
        ws_manager.disconnect(table_id, session_id, websocket)
    except Exception:
        logger.exception("WebSocket error for session %s at table %s", session_id, table_id)
        ws_manager.disconnect(table_id, session_id, websocket)


# --- Serve frontend (production build) ---
if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file = FRONTEND_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(FRONTEND_DIR / "index.html")
