"""Table game actions router — actions, start, social, dealer events."""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.database import async_session as async_session_factory
from backend.models.tables import Table, Player, GameRound, RoundAction
from backend.schemas.schemas import (
    GameAction, StartGame, RebuyRequest, RebuyApprove, RebuyDeny,
    TipPlayer, AccuseStalling, RevealCard, AwayStatus,
    FrolTip, FrolDecline, OkResponse,
)
from backend.services.game_engine import game_engine, PlayerState
from backend.services.dealer import (
    get_frol_tip_request, calculate_frol_tip, handle_frol_decline, get_frol_auto_tip,
)
from backend.services.timer import timer_manager
from backend.services.rebuy import rebuy_manager
from backend.ws.manager import manager as ws_manager

router = APIRouter(prefix="/api/tables/{table_id}", tags=["game"])


def _get_game_or_404(table_id: str):
    game = game_engine.get_game(table_id)
    if not game:
        raise HTTPException(404, "Game not found")
    return game


def _get_player_or_403(game, session_id: str):
    player = game.get_player_by_session(session_id)
    if not player:
        raise HTTPException(403, "Not at this table")
    return player


def _verify_admin(game, session_id: str):
    # Check admin via first player with is_admin-like logic
    # admin is whoever created the table
    player = game.get_player_by_session(session_id)
    if not player:
        raise HTTPException(403, "Not at this table")
    # We store admin in DB; for in-memory we check by comparing session_id
    return player


async def _broadcast_game_state(table_id: str, game):
    """Broadcast personalized game state to each connected player."""
    for p in game.players:
        snapshot = game_engine.get_game_snapshot(game, for_session_id=p.session_id)
        await ws_manager.send_personal(table_id, p.session_id, "game_state", snapshot)


async def _start_turn_timer(table_id: str, game):
    """Start a turn timer for the current player."""
    if game.current_player_index is None:
        return

    current_player = game_engine._player_at_seat(game, game.current_player_index)
    if not current_player:
        return

    # If player is away, auto-action immediately
    if current_player.away:
        result = game_engine.auto_action(game, current_player)
        actual_action = result.get("action", "check" if game.current_bet <= current_player.bet_this_round else "fold")
        await ws_manager.broadcast_all(table_id, "action_made", {
            "player_id": current_player.player_id,
            "action": actual_action,
            "auto": True,
        })
        await _broadcast_game_state(table_id, game)
        await _check_hand_end(table_id, game, result)
        return

    async def on_timeout():
        # Guard: if by the time this fires the player already acted (race with HTTP request),
        # bail out — the HTTP handler already handled state changes and broadcasts.
        if (
            game.current_player_index != current_player.seat_index
            or current_player.status != "active"
        ):
            return

        # Save time bank remainder before auto-action
        tmr = timer_manager.get_timer(table_id)
        if tmr:
            current_player.time_bank = tmr.remaining_time_bank
        result = game_engine.auto_action(game, current_player)
        actual_action = result.get("action", "check")
        for k, v in result.items():
            if k in ("folded",):
                actual_action = "fold"
            elif k in ("checked",):
                actual_action = "check"
        await ws_manager.broadcast_all(table_id, "action_made", {
            "player_id": current_player.player_id,
            "action": actual_action,
            "auto": True,
        })
        await _broadcast_game_state(table_id, game)
        await _check_hand_end(table_id, game, result)

    async def on_time_bank_start():
        await ws_manager.broadcast_all(table_id, "time_bank_update", {
            "player_id": current_player.player_id,
            "time_bank": current_player.time_bank,
            "using_time_bank": True,
        })

    timer_manager.start_timer(
        table_id=table_id,
        player_id=current_player.player_id,
        time_limit=game.time_per_move,
        time_bank=current_player.time_bank,
        on_timeout=on_timeout,
        on_time_bank_start=on_time_bank_start,
    )

    await ws_manager.broadcast_all(table_id, "turn_started", {
        "player_id": current_player.player_id,
        "time_limit": game.time_per_move,
        "time_bank": current_player.time_bank,
    })


async def _process_pending_cashouts(table_id: str, game):
    """Process any cashouts that were requested during an active hand."""
    if not game.pending_cashout_sessions:
        return

    from backend.database import async_session
    from backend.models.tables import Player as PlayerModel
    from sqlalchemy import select as sa_select

    pending = list(game.pending_cashout_sessions)
    game.pending_cashout_sessions.clear()

    for sid in pending:
        player_state = game.get_player_by_session(sid)
        if not player_state:
            continue

        cashout_amount = player_state.stack
        player_state.total_cashout += cashout_amount

        game.cashout_ledger.append({
            "nickname": player_state.nickname,
            "total_buyin": player_state.total_buyin,
            "total_cashout": player_state.total_cashout,
            "current_stack": 0,
        })

        async with async_session() as db:
            result = await db.execute(
                sa_select(PlayerModel).where(
                    PlayerModel.table_id == table_id,
                    PlayerModel.session_id == sid,
                )
            )
            db_player = result.scalar_one_or_none()
            if db_player:
                await db.delete(db_player)
                await db.commit()

        game_engine.remove_player(table_id, sid)

        await ws_manager.broadcast_all(table_id, "player_left", {
            "player_id": player_state.player_id,
            "cashout": cashout_amount,
        })

    # Broadcast updated game state
    for p in game.players:
        snapshot = game_engine.get_game_snapshot(game, for_session_id=p.session_id)
        await ws_manager.send_personal(table_id, p.session_id, "game_state", snapshot)


async def _post_hand_continuation(table_id: str, game, end_data: dict):
    """Background task: wait for frol tip, handle pending cashouts, rebuy window, then auto-start."""
    import asyncio

    delay = 5 if end_data.get("showdown") else 2

    # Wait for Frol tip resolution (up to tip_timeout + buffer)
    if getattr(game, '_frol_tip_pending', False):
        for _ in range(20):
            await asyncio.sleep(1)
            if not getattr(game, '_frol_tip_pending', False):
                break
        # If still pending after timeout, auto-tip
        if getattr(game, '_frol_tip_pending', False):
            game._frol_tip_pending = False
            last_req = getattr(game, '_last_frol_tip_request', None)
            if last_req:
                winner_player = game.get_player_by_id(last_req.get("winner_id"))
                if winner_player:
                    auto_amount = get_frol_auto_tip(last_req.get("pot", 0))
                    tip = min(auto_amount, winner_player.stack)
                    winner_player.stack -= tip
                    game.frol_total_tips += tip
                    await ws_manager.broadcast_all(table_id, "tip_given", {
                        "from_id": winner_player.player_id,
                        "to_id": "frol",
                        "amount": tip,
                        "target": "frol",
                    })
                    await _broadcast_game_state(table_id, game)

    # Process pending cashouts
    await _process_pending_cashouts(table_id, game)

    bust_players = [p for p in game.players if p.status == "bust"]
    non_bust = [p for p in game.players if p.status != "bust" and p.stack > 0]

    if bust_players and game.stage == "waiting":
        # Broadcast rebuy window to all clients
        await ws_manager.broadcast_all(table_id, "rebuy_window", {
            "bust_player_ids": [p.player_id for p in bust_players],
            "timeout": 20,
        })

        game._rebuy_window_active = True
        game._rebuy_window_bust_ids = {p.player_id for p in bust_players}

        await asyncio.sleep(delay)

        # Wait up to 20 seconds for rebuy requests
        for _ in range(20):
            await asyncio.sleep(1)
            still_bust = [p for p in game.players if p.player_id in game._rebuy_window_bust_ids and p.status == "bust"]
            if not still_bust:
                break

        game._rebuy_window_active = False
        game._rebuy_window_bust_ids = set()

        # Remove bust players who didn't rebuy from game and DB
        still_bust = [p for p in game.players if p.player_id in {bp.player_id for bp in bust_players} and p.status == "bust"]
        for p in still_bust:
            # Add to cashout ledger before removal so they stay visible
            game.cashout_ledger.append({
                "nickname": p.nickname,
                "total_buyin": p.total_buyin,
                "total_cashout": 0,
                "current_stack": 0,
            })
            game_engine.remove_player(table_id, p.session_id)
            # Remove from DB
            async with async_session_factory() as db:
                from sqlalchemy import select as sa_select
                result = await db.execute(
                    sa_select(Player).where(
                        Player.table_id == table_id,
                        Player.session_id == p.session_id,
                    )
                )
                db_player = result.scalar_one_or_none()
                if db_player:
                    await db.delete(db_player)
                    await db.commit()
            await ws_manager.broadcast_all(table_id, "player_left", {
                "player_id": p.player_id,
            })

        await ws_manager.broadcast_all(table_id, "rebuy_window_closed", {})
        await _broadcast_game_state(table_id, game)

        can_play = [p for p in game.players if p.status != "bust" and p.stack > 0]
        if len(can_play) >= 2:
            await _auto_start_next_hand(table_id, game)
    elif game.stage == "waiting" and len(non_bust) >= 2:
        await asyncio.sleep(delay)
        await _auto_start_next_hand(table_id, game)


async def _danilka_restart(table_id: str, game):
    """Background task: restart after danilka cancel."""
    import asyncio
    await asyncio.sleep(3)
    await _auto_start_next_hand(table_id, game)


async def _check_hand_end(table_id: str, game, result: dict):
    """Check if hand ended and handle post-hand logic."""
    if result.get("advance") and result["advance"].get("type") == "round_end":
        timer_manager.cancel_timer(table_id)
        end_data = result["advance"]
        await ws_manager.broadcast_all(table_id, "round_end", end_data)

        # Broadcast game state with showdown stage so clients see hole cards
        # Only set showdown stage for actual showdowns, not fold wins
        if end_data.get("showdown"):
            game.stage = "showdown"
            await _broadcast_game_state(table_id, game)
        game.stage = "waiting"

        # Now mark players with 0 chips as bust
        for p in game.players:
            if p.stack <= 0 and p.status in ("active", "allin", "folded"):
                p.status = "bust"

        # Broadcast updated state so clients see bust status
        await _broadcast_game_state(table_id, game)

        # Sync player stacks to DB
        await _sync_stacks_to_db(table_id, game)

        # Frol tip check — set pending flag so post-hand continuation waits
        if game.dealer_type == "frol" and end_data.get("showdown") and end_data.get("winners"):
            winner = end_data["winners"][0]
            pot = end_data.get("pot", 0)
            tip_req = get_frol_tip_request(pot, winner["player_id"])
            game._last_frol_tip_request = tip_req  # store for decline endpoint
            game._frol_tip_pending = True
            winner_player = game.get_player_by_id(winner["player_id"])
            if winner_player:
                await ws_manager.send_personal(table_id, winner_player.session_id, "frol_tip_request", tip_req)

        # Check blind increase for tournament
        blind_event = game_engine.check_blind_increase(game)
        if blind_event:
            await ws_manager.broadcast_all(table_id, "blinds_raised", blind_event)

        # Check tournament game over (one player left with chips)
        if game.game_type == "tournament":
            non_bust = [p for p in game.players if p.status != "bust" and p.stack > 0]
            if len(non_bust) == 1:
                winner_p = non_bust[0]
                await ws_manager.broadcast_all(table_id, "game_over", {
                    "winner_id": winner_p.player_id,
                    "final_stacks": {p.player_id: p.stack for p in game.players},
                })
                game.stage = "finished"
                await _update_table_status(table_id, "finished")
                return True

        # Schedule post-hand continuation (rebuy window + auto-start) as background task
        # so the HTTP response is not blocked
        import asyncio
        asyncio.ensure_future(_post_hand_continuation(table_id, game, end_data))

        return True

    # Danilka cancel
    if result.get("advance") and result["advance"].get("danilka_cancel"):
        timer_manager.cancel_timer(table_id)
        cancel_data = game_engine.cancel_danilka_hand(game)
        await ws_manager.broadcast_all(table_id, "danilka_event", {"type": "cards_spill"})
        await _broadcast_game_state(table_id, game)

        # Auto-start next hand after danilka cancel (background)
        import asyncio
        asyncio.ensure_future(_danilka_restart(table_id, game))
        return True

    # If there's a new current player, start their timer
    if game.current_player_index is not None:
        await _start_turn_timer(table_id, game)

    return False


async def _sync_stacks_to_db(table_id: str, game):
    """Sync in-memory player stacks to database."""
    async with async_session_factory() as db:
        for p in game.players:
            result = await db.execute(select(Player).where(Player.id == p.player_id))
            db_player = result.scalar_one_or_none()
            if db_player:
                db_player.stack = p.stack
                db_player.status = p.status
                db_player.time_bank = p.time_bank
        await db.commit()


async def _update_table_status(table_id: str, status: str):
    """Update table status in the database."""
    async with async_session_factory() as db:
        result = await db.execute(select(Table).where(Table.id == table_id))
        table = result.scalar_one_or_none()
        if table:
            table.status = status
            await db.commit()


async def _auto_start_next_hand(table_id: str, game):
    """Automatically start the next hand."""
    events = game_engine.start_new_hand(game)
    if events.get("type") == "insufficient_players":
        return

    # Save round to DB
    async with async_session_factory() as db:
        round_obj = GameRound(
            id=str(uuid.uuid4()),
            table_id=table_id,
            round_number=game.round_number,
            dealer_seat=game.dealer_seat_index,
        )
        db.add(round_obj)
        await db.commit()
        game.round_id = round_obj.id

    # Send personal cards to each player
    cards_map = events.get("cards", {})
    for session_id, cards in cards_map.items():
        await ws_manager.send_personal(table_id, session_id, "cards_dealt", {"your_cards": cards})

    await _broadcast_game_state(table_id, game)
    await _start_turn_timer(table_id, game)


# ---- Start game ----

@router.post("/start", response_model=OkResponse)
async def start_game(table_id: str, body: StartGame, db: AsyncSession = Depends(get_db)):
    game = _get_game_or_404(table_id)

    # Verify admin
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(404, "Table not found")
    if table.admin_session_id != body.session_id:
        raise HTTPException(403, "Only admin can start the game")

    if len(game.players) < 2:
        raise HTTPException(400, "Need at least 2 players")

    table.status = "running"
    await db.commit()

    events = game_engine.start_new_hand(game)

    # Save round to DB
    round_obj = GameRound(
        id=str(uuid.uuid4()),
        table_id=table_id,
        round_number=game.round_number,
        dealer_seat=game.dealer_seat_index,
    )
    db.add(round_obj)
    await db.commit()
    game.round_id = round_obj.id

    # Send personal cards to each player
    cards_map = events.get("cards", {})
    for session_id, cards in cards_map.items():
        await ws_manager.send_personal(table_id, session_id, "cards_dealt", {"your_cards": cards})

    await _broadcast_game_state(table_id, game)
    await _start_turn_timer(table_id, game)

    return OkResponse()


# ---- Game action ----

@router.post("/action")
async def game_action(table_id: str, body: GameAction, db: AsyncSession = Depends(get_db)):
    game = _get_game_or_404(table_id)
    player = _get_player_or_403(game, body.session_id)

    # Save remaining time bank before canceling timer
    tmr = timer_manager.get_timer(table_id)
    if tmr and tmr.player_id == player.player_id:
        player.time_bank = tmr.remaining_time_bank

    timer_manager.cancel_timer(table_id)

    result = game_engine.process_action(game, body.session_id, body.action, body.amount)

    if "error" in result:
        error_msg = result["error"]
        # Race condition: timer auto-acted just before this request arrived.
        # Don't restart the timer (on_timeout already handles it) — just return
        # the current state so the client can update via WebSocket.
        if error_msg in ("Not your turn", "Cannot act in current status", "No active turn"):
            snapshot = game_engine.get_game_snapshot(game, for_session_id=body.session_id)
            return {"ok": True, "raced": True, "game_state_snapshot": snapshot}
        # Genuine invalid action (bad amount, nothing to call, etc.) –
        # restart the timer so the player can try again.
        await _start_turn_timer(table_id, game)
        raise HTTPException(400, error_msg)

    # Log action
    if game.round_id:
        player = game.get_player_by_session(body.session_id)
        action_log = RoundAction(
            round_id=game.round_id,
            player_id=player.player_id if player else "",
            action=body.action,
            amount=body.amount,
            stage=game.stage,
        )
        db.add(action_log)
        await db.commit()

    await ws_manager.broadcast_all(table_id, "action_made", {
        "player_id": result.get("player_id"),
        "action": body.action,
        "amount": body.amount,
    })

    hand_ended = await _check_hand_end(table_id, game, result)

    if not hand_ended:
        await _broadcast_game_state(table_id, game)

    snapshot = game_engine.get_game_snapshot(game, for_session_id=body.session_id)
    return {"ok": True, "game_state_snapshot": snapshot}


# ---- Rebuy ----

@router.post("/rebuy/request")
async def request_rebuy(table_id: str, body: RebuyRequest, db: AsyncSession = Depends(get_db)):
    game = _get_game_or_404(table_id)
    player = _get_player_or_403(game, body.session_id)

    if game.game_type == "tournament" and game.stage != "waiting" and player.stack > 0:
        raise HTTPException(400, "Rebuy only allowed before hand starts or at 0 chips in tournament")

    req = rebuy_manager.create_request(table_id, player.player_id, body.session_id, body.amount)

    # Notify only the table admin
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if table:
        await ws_manager.send_personal(table_id, table.admin_session_id, "rebuy_requested", {
            "player_id": player.player_id,
            "amount": body.amount,
            "request_id": req.request_id,
        })

    return {"ok": True, "request_id": req.request_id}


@router.post("/rebuy/approve", response_model=OkResponse)
async def approve_rebuy(table_id: str, body: RebuyApprove, db: AsyncSession = Depends(get_db)):
    game = _get_game_or_404(table_id)

    # Verify admin
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table or table.admin_session_id != body.session_id:
        raise HTTPException(403, "Only admin can approve rebuy")

    target = game.get_player_by_id(body.target_player_id)
    if not target:
        raise HTTPException(404, "Target player not found")

    target.stack += body.amount
    target.total_buyin += body.amount
    if target.status == "bust":
        target.status = "active"

    # Update DB
    db_result = await db.execute(
        select(Player).where(Player.id == body.target_player_id)
    )
    db_player = db_result.scalar_one_or_none()
    if db_player:
        db_player.stack = target.stack
        db_player.status = target.status
        await db.commit()

    await ws_manager.broadcast_all(table_id, "rebuy_approved", {
        "player_id": body.target_player_id,
        "new_stack": target.stack,
    })

    # Broadcast updated game state so all clients see new stack
    await _broadcast_game_state(table_id, game)

    return OkResponse()


@router.post("/rebuy/deny", response_model=OkResponse)
async def deny_rebuy(table_id: str, body: RebuyDeny, db: AsyncSession = Depends(get_db)):
    game = _get_game_or_404(table_id)

    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table or table.admin_session_id != body.session_id:
        raise HTTPException(403, "Only admin can deny rebuy")

    await ws_manager.broadcast_all(table_id, "rebuy_denied", {
        "player_id": body.target_player_id,
    })

    return OkResponse()


# ---- Social ----

@router.post("/tip", response_model=OkResponse)
async def tip_player(table_id: str, body: TipPlayer):
    game = _get_game_or_404(table_id)
    player = _get_player_or_403(game, body.session_id)

    if body.amount > player.stack:
        raise HTTPException(400, "Not enough chips")
    if body.amount <= 0:
        raise HTTPException(400, "Invalid tip amount")

    target = game.get_player_by_id(body.target_player_id)
    if not target:
        raise HTTPException(404, "Target not found")

    player.stack -= body.amount
    target.stack += body.amount

    await ws_manager.broadcast_all(table_id, "tip_given", {
        "from_id": player.player_id,
        "to_id": target.player_id,
        "amount": body.amount,
        "target": "player",
    })

    await _broadcast_game_state(table_id, game)

    return OkResponse()


@router.post("/accuse-stalling")
async def accuse_stalling(table_id: str, body: AccuseStalling):
    game = _get_game_or_404(table_id)
    accuser = _get_player_or_403(game, body.session_id)

    target = game.get_player_by_id(body.target_player_id)
    if not target:
        raise HTTPException(404, "Target not found")

    # Can only accuse if it's target's turn
    if game.current_player_index is None:
        raise HTTPException(400, "No active turn")

    current = game_engine._player_at_seat(game, game.current_player_index)
    if not current or current.player_id != target.player_id:
        raise HTTPException(400, "Can only accuse the player whose turn it is")

    # One accusation per accuser per hand
    accusations = game.stalling_accusations.setdefault(accuser.player_id, set())
    if target.player_id in accusations:
        raise HTTPException(400, "Already accused this player this hand")
    accusations.add(target.player_id)

    # Reduce time bank to 10
    target.time_bank = 10
    timer = timer_manager.get_timer(table_id)
    if timer:
        timer.reduce_time_bank(10)

    await ws_manager.broadcast_all(table_id, "stalling_accused", {
        "accuser_id": accuser.player_id,
        "target_id": target.player_id,
    })

    return {"ok": True, "new_time_bank": 10}


@router.post("/reveal-card", response_model=OkResponse)
async def reveal_card(table_id: str, body: RevealCard):
    game = _get_game_or_404(table_id)
    player = _get_player_or_403(game, body.session_id)

    if body.card_index in player.revealed_cards:
        raise HTTPException(400, "Card already revealed")

    if not player.hole_cards or body.card_index >= len(player.hole_cards):
        raise HTTPException(400, "No card to reveal")

    player.revealed_cards.append(body.card_index)

    from treys import Card
    card_str = Card.int_to_str(player.hole_cards[body.card_index])

    await ws_manager.broadcast_all(table_id, "card_revealed", {
        "player_id": player.player_id,
        "card_index": body.card_index,
        "card": card_str,
    })

    return OkResponse()


@router.post("/away", response_model=OkResponse)
async def set_away(table_id: str, body: AwayStatus):
    game = _get_game_or_404(table_id)
    player = _get_player_or_403(game, body.session_id)

    player.away = body.away

    await ws_manager.broadcast_all(table_id, "player_away", {
        "player_id": player.player_id,
        "away": body.away,
    })

    return OkResponse()


# ---- Frol tip ----

@router.post("/frol-tip", response_model=OkResponse)
async def frol_tip(table_id: str, body: FrolTip):
    game = _get_game_or_404(table_id)
    player = _get_player_or_403(game, body.session_id)

    tip_amount = min(body.amount, player.stack)
    player.stack -= tip_amount
    game.frol_total_tips += tip_amount
    game._frol_tip_pending = False

    await ws_manager.broadcast_all(table_id, "tip_given", {
        "from_id": player.player_id,
        "to_id": "frol",
        "amount": tip_amount,
        "target": "frol",
    })

    await _broadcast_game_state(table_id, game)

    return OkResponse()


@router.post("/frol-tip/decline")
async def frol_tip_decline(table_id: str, body: FrolDecline):
    game = _get_game_or_404(table_id)
    player = _get_player_or_403(game, body.session_id)

    # Check if there's a pending frol tip request for this player
    last_tip_req = getattr(game, '_last_frol_tip_request', None)
    if last_tip_req and last_tip_req.get("decline_button_type") == "trick":
        # Trick button: user actually pays 100% of pot
        pot = last_tip_req.get("pot", 0)
        tip_amount = min(pot, player.stack)
        player.stack -= tip_amount
        game.frol_total_tips += tip_amount
        game._frol_tip_pending = False
        await ws_manager.broadcast_all(table_id, "tip_given", {
            "from_id": player.player_id,
            "to_id": "frol",
            "amount": tip_amount,
            "target": "frol",
        })
        await _broadcast_game_state(table_id, game)
        return {"declined": False, "reason": "trick_button"}

    game._frol_tip_pending = False
    return {"ok": True}
