"""
Poker App — FastAPI main entry point.
"""

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import CORS_ORIGINS, AVATARS_DIR, PLAYER_AVATARS_DIR, APP_VERSION, DATABASE_URL

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
from backend.database import init_db
from backend.routers import lobby, tables, players
from backend.ws.manager import manager as ws_manager
from backend.services.game_engine import game_engine

# Import models for recovery
from sqlalchemy import select
from backend.database import async_session
from backend.models.tables import Table, Player


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
            )
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
                    )
                )
    
    logger.info("Poker server started and games recovered from DB")
    yield
    # Shutdown
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

    await ws_manager.connect(table_id, session_id, websocket)

    # Send initial game state
    game = game_engine.get_game(table_id)
    if game:
        snapshot = game_engine.get_game_snapshot(game, for_session_id=session_id)
        await ws_manager.send_personal(table_id, session_id, "game_state", snapshot)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            # Handle ping/pong keepalive
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        ws_manager.disconnect(table_id, session_id)
    except Exception:
        ws_manager.disconnect(table_id, session_id)


# --- Serve frontend (production build) ---
if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file = FRONTEND_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(FRONTEND_DIR / "index.html")
