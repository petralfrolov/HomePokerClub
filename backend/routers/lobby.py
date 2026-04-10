"""Lobby router — list/create/get tables, join/leave."""

import secrets
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import MAX_PLAYERS_PER_TABLE
from backend.database import get_db
from backend.models.tables import Table, Player, Session, GameRound, RoundAction
from backend.schemas.schemas import (
    TableCreate, TableCreated, TableSummary, TableDetail,
    PlayerInfo, JoinTable, JoinResult, LeaveTable, CashoutRequest, OkResponse,
)
from backend.services.game_engine import game_engine, GameState, PlayerState
from backend.ws.manager import manager as ws_manager

router = APIRouter(prefix="/api/tables", tags=["tables"])


async def _ensure_session(db: AsyncSession, session_id: str) -> Session:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        session = Session(id=session_id)
        db.add(session)
        await db.flush()
    return session


@router.get("", response_model=list[TableSummary])
async def list_tables(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Table).where(Table.status != "finished"))
    tables = result.scalars().all()
    return [
        TableSummary(
            id=t.id,
            name=t.name,
            type=t.type,
            players_count=len(t.players),
            max_players=MAX_PLAYERS_PER_TABLE,
            blind_small=t.blind_small,
            status=t.status,
        )
        for t in tables
    ]


@router.post("", response_model=TableCreated)
async def create_table(body: TableCreate, db: AsyncSession = Depends(get_db)):
    # Validation
    if body.type == "cash" and (body.min_buyin is None or body.max_buyin is None):
        raise HTTPException(400, "Cash game requires min_buyin and max_buyin")
    if body.type == "tournament" and body.starting_stack is None:
        raise HTTPException(400, "Tournament requires starting_stack")

    table_id = str(uuid.uuid4())
    invite_code = secrets.token_urlsafe(6)

    table = Table(
        id=table_id,
        invite_code=invite_code,
        name=body.name,
        admin_session_id="",  # set on first join
        type=body.type,
        dealer_type=body.dealer_type,
        blind_small=body.blind_small,
        blind_big=body.blind_big,
        time_per_move=body.time_per_move,
        time_bank_max=body.time_bank,
        min_buyin=body.min_buyin,
        max_buyin=body.max_buyin,
        starting_stack=body.starting_stack,
        tournament_blind_interval=body.tournament_blind_interval or 10,
    )
    db.add(table)
    await db.commit()

    # Create in-memory game state
    game_engine.create_game(
        table_id=table_id,
        game_type=body.type,
        blind_small=body.blind_small,
        blind_big=body.blind_big,
        time_per_move=body.time_per_move,
        time_bank_max=body.time_bank,
        dealer_type=body.dealer_type,
        tournament_blind_interval=body.tournament_blind_interval or 10,
    )

    return TableCreated(table_id=table_id, invite_code=invite_code)


@router.get("/{table_id}", response_model=TableDetail)
async def get_table(table_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(404, "Table not found")

    return TableDetail(
        id=table.id,
        invite_code=table.invite_code,
        name=table.name,
        admin_session_id=table.admin_session_id,
        type=table.type,
        dealer_type=table.dealer_type,
        blind_small=table.blind_small,
        blind_big=table.blind_big,
        time_per_move=table.time_per_move,
        time_bank_max=table.time_bank_max,
        min_buyin=table.min_buyin,
        max_buyin=table.max_buyin,
        starting_stack=table.starting_stack,
        tournament_blind_interval=table.tournament_blind_interval,
        status=table.status,
        players=[
            PlayerInfo(
                id=p.id,
                session_id=p.session_id,
                nickname=p.nickname,
                avatar_url=p.avatar_url,
                seat_index=p.seat_index,
                stack=p.stack,
                time_bank=p.time_bank,
                status=p.status,
                is_admin=p.is_admin,
            )
            for p in table.players
        ],
    )


@router.post("/{table_id}/join", response_model=JoinResult)
async def join_table(table_id: str, body: JoinTable, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(404, "Table not found")

    if len(table.players) >= MAX_PLAYERS_PER_TABLE:
        raise HTTPException(400, "Table is full")

    # Check duplicate session — allow reconnect
    for p in table.players:
        if p.session_id == body.session_id:
            return JoinResult(player_id=p.id, seat_index=p.seat_index)

    # Validate buyin
    if table.type == "cash":
        if table.min_buyin and body.buyin < table.min_buyin:
            raise HTTPException(400, f"Minimum buy-in is {table.min_buyin}")
        if table.max_buyin and body.buyin > table.max_buyin:
            raise HTTPException(400, f"Maximum buy-in is {table.max_buyin}")

    stack = table.starting_stack if table.type == "tournament" else body.buyin

    await _ensure_session(db, body.session_id)

    # Assign seat
    taken_seats = {p.seat_index for p in table.players}
    seat_index = next(i for i in range(MAX_PLAYERS_PER_TABLE) if i not in taken_seats)

    is_admin = len(table.players) == 0
    if is_admin:
        table.admin_session_id = body.session_id

    # Get avatar
    sess_result = await db.execute(select(Session).where(Session.id == body.session_id))
    sess = sess_result.scalar_one_or_none()
    avatar_url = sess.avatar_url if sess else None

    player = Player(
        id=str(uuid.uuid4()),
        session_id=body.session_id,
        table_id=table_id,
        nickname=body.nickname,
        avatar_url=avatar_url,
        seat_index=seat_index,
        stack=stack,
        time_bank=table.time_bank_max,
        is_admin=is_admin,
    )
    db.add(player)

    # Update session nickname
    if sess:
        sess.nickname = body.nickname

    await db.commit()

    # Add to in-memory game
    game = game_engine.get_game(table_id)
    if game:
        # If a hand is in progress, new player sits out until next hand
        join_status = "folded" if game.stage not in ("waiting",) else "active"
        game_engine.add_player(
            table_id,
            PlayerState(
                player_id=player.id,
                session_id=body.session_id,
                nickname=body.nickname,
                seat_index=seat_index,
                stack=stack,
                time_bank=table.time_bank_max,
                total_buyin=stack,
                status=join_status,
            ),
        )

    # Broadcast
    await ws_manager.broadcast_all(table_id, "player_joined", {
        "player": {
            "id": player.id,
            "session_id": body.session_id,
            "nickname": body.nickname,
            "avatar_url": avatar_url,
            "seat_index": seat_index,
            "stack": stack,
            "status": join_status if game else "active",
            "is_admin": is_admin,
        }
    })

    # Broadcast updated game state so all clients see the new player
    if game:
        game_engine.touch(table_id)
        for p in game.players:
            snapshot = game_engine.get_game_snapshot(game, for_session_id=p.session_id)
            await ws_manager.send_personal(table_id, p.session_id, "game_state", snapshot)

    return JoinResult(player_id=player.id, seat_index=seat_index)


@router.post("/{table_id}/leave", response_model=OkResponse)
async def leave_table(table_id: str, body: LeaveTable, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Player).where(Player.table_id == table_id, Player.session_id == body.session_id)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(404, "Player not at this table")

    player_id = player.id
    await db.delete(player)
    await db.commit()

    game_engine.remove_player(table_id, body.session_id)

    await ws_manager.broadcast_all(table_id, "player_left", {"player_id": player_id})

    # Broadcast updated game state so all clients see the player removal
    game = game_engine.get_game(table_id)
    if game:
        for p in game.players:
            snapshot = game_engine.get_game_snapshot(game, for_session_id=p.session_id)
            await ws_manager.send_personal(table_id, p.session_id, "game_state", snapshot)

    return OkResponse()


@router.delete("/{table_id}", response_model=OkResponse)
async def delete_table(table_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(404, "Table not found")

    # Only allow deletion if no players are at the table
    p_result = await db.execute(select(Player).where(Player.table_id == table_id))
    if p_result.scalars().first() is not None:
        raise HTTPException(400, "Cannot delete table with players")

    # Delete round actions for all rounds of this table
    rounds_result = await db.execute(select(GameRound).where(GameRound.table_id == table_id))
    rounds = rounds_result.scalars().all()
    for r in rounds:
        actions_result = await db.execute(select(RoundAction).where(RoundAction.round_id == r.id))
        for a in actions_result.scalars().all():
            await db.delete(a)
        await db.delete(r)

    await db.delete(table)
    await db.commit()

    game_engine.remove_game(table_id)

    return OkResponse()


@router.post("/{table_id}/cashout", response_model=OkResponse)
async def cashout(table_id: str, body: CashoutRequest, db: AsyncSession = Depends(get_db)):
    """Cash out: record current stack as cashout, remove player from table."""
    game = game_engine.get_game(table_id)
    if not game:
        raise HTTPException(404, "Game not found")

    # Only allow cashout when hand is not in progress for this player
    player_state = game.get_player_by_session(body.session_id)
    if not player_state:
        raise HTTPException(403, "Not at this table")

    if game.stage not in ("waiting",) and player_state.status in ("active", "allin"):
        # Auto-fold the player so they can cash out immediately
        if player_state.status == "active":
            player_state.status = "folded"
            await ws_manager.broadcast_all(table_id, "action_made", {
                "player_id": player_state.player_id,
                "action": "fold",
                "amount": None,
            })
        # For all-in players, just mark as folded (forfeit the pot)
        elif player_state.status == "allin":
            player_state.status = "folded"

        # Check if this fold ended the hand (1 active player left wins the pot)
        from backend.routers.tables import _check_hand_end, _start_turn_timer, _broadcast_game_state
        from backend.services.timer import timer_manager
        timer_manager.cancel_timer(table_id)
        advance_result = game_engine._try_advance(game)
        if advance_result:
            result_dict = {"advance": advance_result}
            await _check_hand_end(table_id, game, result_dict)

    cashout_amount = player_state.stack
    player_state.total_cashout += cashout_amount

    # Save to ledger before removing
    game.cashout_ledger.append({
        "nickname": player_state.nickname,
        "total_buyin": player_state.total_buyin,
        "total_cashout": player_state.total_cashout,
        "current_stack": 0,
    })

    # Remove from DB
    result = await db.execute(
        select(Player).where(Player.table_id == table_id, Player.session_id == body.session_id)
    )
    db_player = result.scalar_one_or_none()
    if db_player:
        await db.delete(db_player)
        await db.commit()

    # Remove from in-memory game
    game_engine.remove_player(table_id, body.session_id)

    await ws_manager.broadcast_all(table_id, "player_left", {
        "player_id": player_state.player_id,
        "cashout": cashout_amount,
    })

    # Broadcast updated game state
    for p in game.players:
        snapshot = game_engine.get_game_snapshot(game, for_session_id=p.session_id)
        await ws_manager.send_personal(table_id, p.session_id, "game_state", snapshot)

    # If hand is still in progress after removal, advance turn if needed
    if game.stage not in ("waiting", "showdown", "finished"):
        from backend.routers.tables import _start_turn_timer, _broadcast_game_state
        from backend.services.timer import timer_manager

        # Move turn to next valid player if current seat is now empty
        if game.current_player_index is not None:
            current = game_engine._player_at_seat(game, game.current_player_index)
            if not current or current.status != "active":
                timer_manager.cancel_timer(table_id)
                game.current_player_index = game_engine._next_betting_seat(game, game.current_player_index)
                await _start_turn_timer(table_id, game)
        await _broadcast_game_state(table_id, game)

    return OkResponse()
