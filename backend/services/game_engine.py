"""
Core Texas Hold'em game engine using the treys library for hand evaluation.
Manages deck, dealing, betting rounds, pot calculation, side pots, and showdown.
"""

import json
import logging
import random
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from treys import Card, Deck, Evaluator

from backend.config import (
    DANILKA_EVENT_CHANCE,
    DANILKA_MAX_DEAL_ATTEMPTS,
    DEFAULT_TIME_BANK,
    GAME_LOG_MAX_ENTRIES,
)

logger = logging.getLogger("poker.engine")

evaluator = Evaluator()

STAGES = ["preflop", "flop", "turn", "river", "showdown"]

# Hand rank class to Russian name
HAND_CLASS_NAMES_RU = {
    1: "Стрит-флеш",
    2: "Каре",
    3: "Фулл-хаус",
    4: "Флеш",
    5: "Стрит",
    6: "Тройка",
    7: "Две пары",
    8: "Пара",
    9: "Старшая карта",
}

# Danilka strong hands (as rank pairs)
DANILKA_STRONG_HANDS = [
    ("A", "A"), ("K", "K"), ("Q", "Q"), ("J", "J")
]


@dataclass
class SidePot:
    amount: int
    eligible_player_ids: list[str]


@dataclass
class PlayerState:
    player_id: str
    session_id: str
    nickname: str
    seat_index: int
    stack: int
    hole_cards: list[int] = field(default_factory=list)  # treys Card ints
    bet_this_round: int = 0
    total_bet_this_hand: int = 0
    status: str = "active"  # active, folded, allin, bust
    revealed_cards: list[int] = field(default_factory=list)  # indices 0 or 1
    has_acted_this_round: bool = False
    away: bool = False
    time_bank: int = DEFAULT_TIME_BANK  # remaining time bank in seconds
    total_buyin: int = 0  # total chips bought in
    total_cashout: int = 0  # total chips cashed out
    avatar_url: str | None = None


@dataclass
class GameState:
    table_id: str
    game_type: str  # cash / tournament
    blind_small: int
    blind_big: int
    time_per_move: int
    time_bank_max: int
    dealer_type: str
    tournament_blind_interval: int | None = None

    players: list[PlayerState] = field(default_factory=list)
    dealer_seat_index: int = 0
    round_number: int = 0
    stage: str = "waiting"  # waiting, preflop, flop, turn, river, showdown
    deck: Any = None
    community_cards: list[int] = field(default_factory=list)
    pot: int = 0
    side_pots: list[SidePot] = field(default_factory=list)
    current_player_index: int | None = None
    current_bet: int = 0
    min_raise: int = 0
    last_raiser_index: int | None = None
    danilka_event_this_round: bool = False
    round_id: str | None = None

    # stalling tracking: {accuser_player_id: set of target_player_ids this hand}
    stalling_accusations: dict[str, set[str]] = field(default_factory=dict)

    # ledger for players who cashed out and left
    cashout_ledger: list[dict[str, Any]] = field(default_factory=list)

    # Frol total tips
    frol_total_tips: int = 0

    # Pending cashout: session_ids that want to cashout after current hand
    pending_cashout_sessions: set[str] = field(default_factory=set)

    # Whether the last hand ended with a showdown (vs fold win)
    last_hand_showdown: bool = False

    # Last activity timestamp (used for idle table cleanup)
    last_activity_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Game action log (recent entries for display in ledger)
    game_log: deque = field(default_factory=lambda: deque(maxlen=GAME_LOG_MAX_ENTRIES))

    # Internal dict indices (rebuilt by _rebuild_indices)
    _idx_by_session: dict[str, PlayerState] = field(default_factory=dict, repr=False)
    _idx_by_id: dict[str, PlayerState] = field(default_factory=dict, repr=False)

    def _rebuild_indices(self) -> None:
        self._idx_by_session = {p.session_id: p for p in self.players}
        self._idx_by_id = {p.player_id: p for p in self.players}

    def active_players(self) -> list[PlayerState]:
        return [p for p in self.players if p.status in ("active", "allin")]

    def betting_players(self) -> list[PlayerState]:
        return [p for p in self.players if p.status == "active"]

    def get_player_by_session(self, session_id: str) -> PlayerState | None:
        return self._idx_by_session.get(session_id)

    def get_player_by_id(self, player_id: str) -> PlayerState | None:
        return self._idx_by_id.get(player_id)

    def add_log(self, message: str) -> None:
        """Add a log entry to the game log (deque auto-trims)."""
        self.game_log.append({
            "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "round": self.round_number,
            "message": message,
        })


class GameEngine:
    def __init__(self) -> None:
        self.games: dict[str, GameState] = {}

    def create_game(self, table_id: str, **kwargs: Any) -> GameState:
        state = GameState(table_id=table_id, **kwargs)
        state._rebuild_indices()
        self.games[table_id] = state
        return state

    def get_game(self, table_id: str) -> GameState | None:
        return self.games.get(table_id)

    def remove_game(self, table_id: str) -> None:
        self.games.pop(table_id, None)
        # Clean up associated rebuy requests to prevent memory leaks
        from backend.services.rebuy import rebuy_manager
        rebuy_manager.clear_table(table_id)

    def touch(self, table_id: str) -> None:
        """Update the last activity timestamp for a table."""
        game = self.games.get(table_id)
        if game:
            game.last_activity_at = datetime.now(timezone.utc)

    def add_player(self, table_id: str, player: PlayerState) -> None:
        state = self.games[table_id]
        state.players.append(player)
        state._idx_by_session[player.session_id] = player
        state._idx_by_id[player.player_id] = player

    def remove_player(self, table_id: str, session_id: str) -> PlayerState | None:
        state = self.games[table_id]
        for i, p in enumerate(state.players):
            if p.session_id == session_id:
                removed = state.players.pop(i)
                state._idx_by_session.pop(removed.session_id, None)
                state._idx_by_id.pop(removed.player_id, None)
                return removed
        return None

    # ---- Deal a new hand ----

    def start_new_hand(self, state: GameState) -> dict[str, Any]:
        """Start a new hand. Returns events dict."""
        state.round_number += 1
        state.stage = "preflop"
        state.community_cards = []
        state.pot = 0
        state.side_pots = []
        state.current_bet = 0
        state.min_raise = state.blind_big
        state.last_raiser_index = None
        state.danilka_event_this_round = False
        state.stalling_accusations = {}

        # Reset player states
        for p in state.players:
            if p.stack <= 0:
                p.status = "bust"
            elif p.away:
                p.status = "sitting_out"
            else:
                p.status = "active"
            p.hole_cards = []
            p.bet_this_round = 0
            p.total_bet_this_hand = 0
            p.revealed_cards = []
            p.has_acted_this_round = False

        active = [p for p in state.players if p.status == "active"]
        if len(active) < 2:
            state.stage = "waiting"
            return {"type": "insufficient_players"}

        # Move dealer button
        state.dealer_seat_index = self._next_active_seat(state, state.dealer_seat_index)

        # Check Danilka event (10% chance)
        danilka_event = False
        if state.dealer_type == "danilka" and random.random() < DANILKA_EVENT_CHANCE:
            danilka_event = True
            state.danilka_event_this_round = True

        # Create deck and deal
        state.deck = Deck()
        if danilka_event:
            self._deal_danilka_strong_hands(state)
        else:
            for p in active:
                p.hole_cards = state.deck.draw(2)

        # Post blinds — heads-up special case: dealer=SB, other=BB
        if len(active) == 2:
            sb_index = state.dealer_seat_index
            bb_index = self._next_active_seat(state, sb_index)
        else:
            sb_index = self._next_active_seat(state, state.dealer_seat_index)
            bb_index = self._next_active_seat(state, sb_index)

        events: dict[str, Any] = {"type": "new_hand", "round_number": state.round_number}
        events["dealer_seat"] = state.dealer_seat_index
        events["danilka_event"] = danilka_event

        state.add_log(f"--- Раздача #{state.round_number} ---")

        sb_player = self._player_at_seat(state, sb_index)
        bb_player = self._player_at_seat(state, bb_index)

        if sb_player:
            sb_amount = min(state.blind_small, sb_player.stack)
            self._place_bet(sb_player, sb_amount)
            events["sb"] = {"player_id": sb_player.player_id, "amount": sb_amount}
            state.add_log(f"{sb_player.nickname} ставит МБ: {sb_amount}")
            if sb_player.stack == 0:
                sb_player.status = "allin"

        if bb_player:
            bb_amount = min(state.blind_big, bb_player.stack)
            self._place_bet(bb_player, bb_amount)
            events["bb"] = {"player_id": bb_player.player_id, "amount": bb_amount}
            state.add_log(f"{bb_player.nickname} ставит ББ: {bb_amount}")
            if bb_player.stack == 0:
                bb_player.status = "allin"

        state.current_bet = state.blind_big

        # First to act is after BB preflop
        state.current_player_index = self._next_betting_seat(state, bb_index)

        # Cards info (personal)
        events["cards"] = {
            p.session_id: [Card.int_to_str(c) for c in p.hole_cards]
            for p in active
        }

        return events

    def _deal_danilka_strong_hands(self, state: GameState) -> None:
        """Deal only strong starting hands for Danilka event, avoiding duplicate cards."""
        suits = "shdc"
        active = [p for p in state.players if p.status == "active"]
        dealt_cards: set[int] = set()

        for p in active:
            found = False
            # Try up to DANILKA_MAX_DEAL_ATTEMPTS times to find a non-colliding hand
            for _ in range(DANILKA_MAX_DEAL_ATTEMPTS):
                hand_type = random.choice(DANILKA_STRONG_HANDS)
                r1, r2 = hand_type
                if r1 == r2:
                    s = random.sample(suits, 2)
                    c1 = Card.new(f"{r1}{s[0]}")
                    c2 = Card.new(f"{r2}{s[1]}")
                elif hand_type in [("A", "K")]:
                    if random.random() < 0.5:
                        s = random.choice(suits)
                        c1 = Card.new(f"{r1}{s}")
                        c2 = Card.new(f"{r2}{s}")
                    else:
                        s = random.sample(suits, 2)
                        c1 = Card.new(f"{r1}{s[0]}")
                        c2 = Card.new(f"{r2}{s[1]}")
                else:
                    s = random.choice(suits)
                    c1 = Card.new(f"{r1}{s}")
                    c2 = Card.new(f"{r2}{s}")
                if c1 not in dealt_cards and c2 not in dealt_cards and c1 != c2:
                    found = True
                    break

            if not found:
                # Fallback: deal from remaining deck cards
                remaining = [c for c in Deck().cards if c not in dealt_cards]
                if len(remaining) >= 2:
                    c1, c2 = remaining[0], remaining[1]
                else:
                    logger.error("Danilka dealing: not enough cards remaining")
                    c1 = c2 = 0

            dealt_cards.add(c1)
            dealt_cards.add(c2)
            p.hole_cards = [c1, c2]

        # Build remaining deck for community cards
        full_deck = Deck().cards
        state.deck = Deck()
        state.deck.cards = [c for c in full_deck if c not in dealt_cards]

    # ---- Player actions ----

    def process_action(self, state: GameState, session_id: str, action: str, amount: int | None = None) -> dict[str, Any]:
        """Process a player action. Returns events."""
        player = state.get_player_by_session(session_id)
        if not player:
            return {"error": "Player not found"}

        if state.current_player_index is None:
            return {"error": "No active turn"}

        current_player = self._player_at_betting_index(state)
        if not current_player or current_player.player_id != player.player_id:
            return {"error": "Not your turn"}

        if player.status != "active":
            return {"error": "Cannot act in current status"}

        result: dict[str, Any] = {"type": "action", "player_id": player.player_id, "action": action}

        if action == "fold":
            player.status = "folded"
            result["folded"] = True

        elif action == "check":
            if state.current_bet > player.bet_this_round:
                return {"error": "Cannot check, must call or raise"}
            result["checked"] = True

        elif action == "call":
            call_amount = min(state.current_bet - player.bet_this_round, player.stack)
            if call_amount <= 0:
                if player.stack == 0:
                    # Player is already all-in from blinds or previous bet
                    player.status = "allin"
                    result["allin"] = True
                    result["amount"] = 0
                else:
                    return {"error": "Nothing to call"}
            else:
                self._place_bet(player, call_amount)
                result["amount"] = call_amount
                if player.stack == 0:
                    player.status = "allin"
                    result["allin"] = True

        elif action == "raise":
            if amount is None:
                return {"error": "Raise amount required"}
            total_bet = amount  # total bet this round
            raise_by = total_bet - state.current_bet
            if raise_by < state.min_raise and player.stack > (total_bet - player.bet_this_round):
                return {"error": f"Minimum raise is {state.min_raise}"}
            bet_needed = total_bet - player.bet_this_round
            actual_bet = min(bet_needed, player.stack)
            self._place_bet(player, actual_bet)
            state.current_bet = player.bet_this_round
            state.min_raise = max(state.min_raise, raise_by)
            state.last_raiser_index = self._seat_to_index(state, player.seat_index)
            result["amount"] = actual_bet
            if player.stack == 0:
                player.status = "allin"
                result["allin"] = True
            # Reset has_acted for other players
            for p in state.betting_players():
                if p.player_id != player.player_id:
                    p.has_acted_this_round = False

        elif action == "allin":
            all_in_amount = player.stack
            self._place_bet(player, all_in_amount)
            if player.bet_this_round > state.current_bet:
                state.current_bet = player.bet_this_round
                state.last_raiser_index = self._seat_to_index(state, player.seat_index)
                for p in state.betting_players():
                    if p.player_id != player.player_id:
                        p.has_acted_this_round = False
            player.status = "allin"
            result["amount"] = all_in_amount
            result["allin"] = True

        else:
            return {"error": "Unknown action"}

        player.has_acted_this_round = True

        # Log the action
        ACTION_NAMES = {
            "fold": "фолд", "check": "чек", "call": "колл",
            "raise": "рейз", "allin": "олл-ин",
        }
        action_name = ACTION_NAMES.get(action, action)
        if action in ("call", "raise", "allin") and result.get("amount"):
            state.add_log(f"{player.nickname}: {action_name} {result['amount']}")
        else:
            state.add_log(f"{player.nickname}: {action_name}")

        # Check if round is over
        advance_result = self._try_advance(state)
        if advance_result:
            result["advance"] = advance_result

        return result

    def auto_action(self, state: GameState, player: PlayerState) -> dict[str, Any]:
        """Auto-action for timeout or away player."""
        if state.current_bet > player.bet_this_round:
            return self.process_action(state, player.session_id, "fold")
        else:
            return self.process_action(state, player.session_id, "check")

    # ---- Advance game ----

    def _try_advance(self, state: GameState) -> dict[str, Any] | None:
        active = state.active_players()

        # Only one player left - they win
        if len(active) == 1:
            return self._end_hand(state, showdown=False)

        # Check if betting round is complete
        betting = state.betting_players()
        if len(betting) == 0:
            # All active players are all-in
            return self._deal_remaining_and_showdown(state)

        # Move to next player
        next_idx = self._next_betting_seat(state, self._get_current_seat(state))
        next_player = self._player_at_seat(state, next_idx)

        if next_player and next_player.has_acted_this_round and next_player.bet_this_round == state.current_bet:
            # All players have acted and bets are equal → advance stage
            return self._advance_stage(state)

        # Not everyone has acted yet
        all_acted = all(p.has_acted_this_round for p in betting)
        all_matched = all(p.bet_this_round == state.current_bet for p in betting)

        if all_acted and all_matched:
            return self._advance_stage(state)

        state.current_player_index = next_idx
        return None

    def _advance_stage(self, state: GameState) -> dict[str, Any] | None:
        """Move to next stage (flop/turn/river/showdown)."""
        # Collect bets into pot
        for p in state.players:
            state.pot += p.bet_this_round
            p.bet_this_round = 0
            p.has_acted_this_round = False
        state.current_bet = 0
        state.min_raise = state.blind_big

        stage_idx = STAGES.index(state.stage)
        if stage_idx >= len(STAGES) - 1:
            return self._end_hand(state, showdown=True)

        next_stage = STAGES[stage_idx + 1]
        state.stage = next_stage

        result: dict[str, Any] = {"new_stage": next_stage}

        STAGE_NAMES = {"flop": "Флоп", "turn": "Тёрн", "river": "Ривер", "showdown": "Шоудаун"}
        stage_label = STAGE_NAMES.get(next_stage, next_stage)
        state.add_log(f"--- {stage_label} ---")

        # Danilka event: cancel on turn
        if state.danilka_event_this_round and next_stage == "turn":
            return {"danilka_cancel": True, "stage": "cancelled"}

        if next_stage == "flop":
            cards = state.deck.draw(3)
            state.community_cards.extend(cards)
            result["cards"] = [Card.int_to_str(c) for c in cards]
        elif next_stage == "turn":
            cards = state.deck.draw(1)
            card = cards[0] if isinstance(cards, list) else cards
            state.community_cards.append(card)
            result["cards"] = [Card.int_to_str(card)]
        elif next_stage == "river":
            cards = state.deck.draw(1)
            card = cards[0] if isinstance(cards, list) else cards
            state.community_cards.append(card)
            result["cards"] = [Card.int_to_str(card)]
        elif next_stage == "showdown":
            return self._end_hand(state, showdown=True)

        # Check if any betting players left
        betting = state.betting_players()
        if len(betting) <= 1:
            # No more betting possible
            if len(state.active_players()) > 1:
                return self._deal_remaining_and_showdown(state)
            return self._end_hand(state, showdown=False)

        # First to act post-flop: first active player after dealer
        state.current_player_index = self._next_betting_seat(state, state.dealer_seat_index)

        return result

    def _deal_remaining_and_showdown(self, state: GameState) -> dict[str, Any]:
        """Deal remaining community cards and go to showdown."""
        # Danilka event: cancel before dealing remaining cards
        if state.danilka_event_this_round and len(state.community_cards) < 4:
            return {"danilka_cancel": True, "stage": "cancelled"}

        result: dict[str, Any] = {"deal_remaining": True, "cards": []}
        while len(state.community_cards) < 5:
            cards = state.deck.draw(1)
            card = cards[0] if isinstance(cards, list) else cards
            state.community_cards.append(card)
            result["cards"].append(Card.int_to_str(card))

        state.stage = "showdown"
        end_result = self._end_hand(state, showdown=True)
        result.update(end_result)
        return result

    def _end_hand(self, state: GameState, showdown: bool) -> dict[str, Any]:
        """End the hand and determine winners."""
        # Collect remaining bets
        for p in state.players:
            state.pot += p.bet_this_round
            p.bet_this_round = 0

        active = state.active_players()
        result: dict[str, Any] = {"type": "round_end", "showdown": showdown}

        if len(active) == 1:
            winner = active[0]
            winner.stack += state.pot
            result["winners"] = [{"player_id": winner.player_id, "amount": state.pot}]
            result["pot"] = state.pot
            state.add_log(f"{winner.nickname} забирает банк {state.pot}")
        elif showdown:
            winners_info = self._resolve_showdown(state, active)
            result["winners"] = winners_info
            result["hands"] = {
                p.player_id: {
                    "cards": [Card.int_to_str(c) for c in p.hole_cards],
                    "rank": evaluator.evaluate(p.hole_cards, state.community_cards)
                    if len(state.community_cards) >= 3 else None,
                    "class": evaluator.get_rank_class(
                        evaluator.evaluate(p.hole_cards, state.community_cards)
                    ) if len(state.community_cards) >= 3 else None,
                }
                for p in active
            }
            result["pot"] = state.pot
            # Log showdown hands and winners
            state.add_log("--- Шоудаун ---")
            for p in active:
                if len(p.hole_cards) == 2 and len(state.community_cards) >= 3:
                    try:
                        rank = evaluator.evaluate(p.hole_cards, state.community_cards)
                        rank_class = evaluator.get_rank_class(rank)
                        hand_name = HAND_CLASS_NAMES_RU.get(rank_class, "")
                        cards_str = " ".join(Card.int_to_str(c) for c in p.hole_cards)
                        state.add_log(f"{p.nickname}: [{cards_str}] — {hand_name}")
                    except Exception:
                        pass
            for w in winners_info:
                wp = state.get_player_by_id(w["player_id"])
                if wp:
                    state.add_log(f"🏆 {wp.nickname} выигрывает {w['amount']}")

        result["community_cards"] = [Card.int_to_str(c) for c in state.community_cards]

        state.pot = 0
        state.stage = "waiting"
        state.current_player_index = None
        state.last_hand_showdown = showdown

        return result

    def _resolve_showdown(self, state: GameState, active: list[PlayerState]) -> list[dict[str, Any]]:
        """Resolve showdown with side pots."""
        winners_info: list[dict[str, Any]] = []

        # Build side pots
        pots = self._calculate_side_pots(state, active)

        for pot_amount, eligible in pots:
            if not eligible:
                continue

            if len(state.community_cards) < 3:
                # Edge case: shouldn't happen, split equally
                share = pot_amount // len(eligible)
                for p in eligible:
                    p.stack += share
                    winners_info.append({"player_id": p.player_id, "amount": share})
                continue

            # Evaluate hands
            best_rank = float("inf")
            best_players: list[PlayerState] = []
            for p in eligible:
                rank = evaluator.evaluate(p.hole_cards, state.community_cards)
                if rank < best_rank:
                    best_rank = rank
                    best_players = [p]
                elif rank == best_rank:
                    best_players.append(p)

            share = pot_amount // len(best_players)
            remainder = pot_amount % len(best_players)
            for i, p in enumerate(best_players):
                award = share + (1 if i < remainder else 0)
                p.stack += award
                winners_info.append({"player_id": p.player_id, "amount": award})

        return winners_info

    def _calculate_side_pots(self, state: GameState, active: list[PlayerState]) -> list[tuple[int, list[PlayerState]]]:
        """Calculate main pot and side pots."""
        bets = sorted(set(p.total_bet_this_hand for p in active))
        pots: list[tuple[int, list[PlayerState]]] = []
        prev_level = 0

        for level in bets:
            increment = level - prev_level
            if increment <= 0:
                continue
            pot_amount = 0
            eligible: list[PlayerState] = []
            for p in state.players:
                contribution = min(p.total_bet_this_hand - prev_level, increment)
                if contribution > 0:
                    pot_amount += contribution
                if p in active and p.total_bet_this_hand >= level:
                    eligible.append(p)
            pots.append((pot_amount, eligible))
            prev_level = level

        return pots if pots else [(state.pot, active)]

    # ---- Danilka cancel ----

    def cancel_danilka_hand(self, state: GameState) -> dict[str, Any]:
        """Cancel current hand due to Danilka event, return all bets."""
        result: dict[str, Any] = {"type": "danilka_cancel"}
        for p in state.players:
            p.stack += p.total_bet_this_hand
            p.bet_this_round = 0
            p.total_bet_this_hand = 0
            p.status = "active" if p.stack > 0 else "bust"
        state.pot = 0
        state.stage = "waiting"
        state.current_player_index = None
        return result

    # ---- Tournament blinds ----

    def check_blind_increase(self, state: GameState) -> dict[str, Any] | None:
        if state.game_type != "tournament" or not state.tournament_blind_interval:
            return None
        if state.round_number % state.tournament_blind_interval == 0:
            state.blind_small *= 2
            state.blind_big *= 2
            return {
                "type": "blinds_raised",
                "blind_small": state.blind_small,
                "blind_big": state.blind_big,
            }
        return None

    # ---- Helpers ----

    def _place_bet(self, player: PlayerState, amount: int) -> None:
        actual = min(amount, player.stack)
        player.stack -= actual
        player.bet_this_round += actual
        player.total_bet_this_hand += actual

    def _next_active_seat(self, state: GameState, current_seat: int) -> int:
        seats = sorted(p.seat_index for p in state.players if p.status not in ("bust", "sitting_out"))
        if not seats:
            return current_seat
        idx = 0
        for i, s in enumerate(seats):
            if s > current_seat:
                idx = i
                break
        else:
            idx = 0
        return seats[idx]

    def _next_betting_seat(self, state: GameState, current_seat: int) -> int:
        seats = sorted(p.seat_index for p in state.players if p.status == "active")
        if not seats:
            return current_seat
        for s in seats:
            if s > current_seat:
                return s
        return seats[0]

    def _player_at_seat(self, state: GameState, seat_index: int) -> PlayerState | None:
        for p in state.players:
            if p.seat_index == seat_index:
                return p
        return None

    def _player_at_betting_index(self, state: GameState) -> PlayerState | None:
        if state.current_player_index is None:
            return None
        return self._player_at_seat(state, state.current_player_index)

    def _seat_to_index(self, state: GameState, seat_index: int) -> int:
        return seat_index

    def _get_current_seat(self, state: GameState) -> int:
        return state.current_player_index or 0

    # ---- Snapshot for clients ----

    def get_game_snapshot(self, state: GameState, for_session_id: str | None = None) -> dict[str, Any]:
        """Build a game state snapshot. Hides other players' cards unless showdown."""
        snapshot: dict[str, Any] = {
            "table_id": state.table_id,
            "round_number": state.round_number,
            "stage": state.stage,
            "pot": state.pot + sum(p.bet_this_round for p in state.players),
            "community_cards": [Card.int_to_str(c) for c in state.community_cards],
            "current_bet": state.current_bet,
            "min_raise": state.min_raise,
            "dealer_seat": state.dealer_seat_index,
            "blind_small": state.blind_small,
            "blind_big": state.blind_big,
            "current_player_seat": state.current_player_index,
            "players": [],
        }

        for p in state.players:
            pdata: dict[str, Any] = {
                "player_id": p.player_id,
                "session_id": p.session_id,
                "nickname": p.nickname,
                "avatar_url": p.avatar_url,
                "seat_index": p.seat_index,
                "stack": p.stack,
                "bet": p.bet_this_round,
                "status": p.status,
                "away": p.away,
                "revealed_cards": [
                    Card.int_to_str(p.hole_cards[i])
                    for i in p.revealed_cards
                    if i < len(p.hole_cards)
                ],
            }

            if p.session_id == for_session_id:
                pdata["hole_cards"] = [Card.int_to_str(c) for c in p.hole_cards]
            elif state.stage == "showdown" and p.status in ("active", "allin", "bust") and p.hole_cards:
                pdata["hole_cards"] = [Card.int_to_str(c) for c in p.hole_cards]
            elif state.stage == "waiting" and state.last_hand_showdown and p.status in ("active", "allin", "bust") and p.hole_cards:
                pdata["hole_cards"] = [Card.int_to_str(c) for c in p.hole_cards]
            else:
                pdata["hole_cards"] = None

            # Hand name: show for own cards or when cards are visible
            can_see_cards = pdata["hole_cards"] is not None
            if can_see_cards and len(p.hole_cards) == 2 and len(state.community_cards) >= 3:
                try:
                    rank = evaluator.evaluate(p.hole_cards, state.community_cards)
                    rank_class = evaluator.get_rank_class(rank)
                    pdata["hand_name"] = HAND_CLASS_NAMES_RU.get(rank_class, "")
                except Exception:
                    pdata["hand_name"] = None
            else:
                pdata["hand_name"] = None

            snapshot["players"].append(pdata)

        # Cashout ledger for all players (including those who left)
        snapshot["cashout_ledger"] = [
            {
                "nickname": p.nickname,
                "total_buyin": p.total_buyin,
                "total_cashout": p.total_cashout,
                "current_stack": p.stack,
            }
            for p in state.players
        ]
        # Include players who already cashed out and left
        for entry in state.cashout_ledger:
            snapshot["cashout_ledger"].append(entry)

        # Frol tip total
        if state.dealer_type == "frol":
            snapshot["frol_total_tips"] = state.frol_total_tips

        # Game action log
        snapshot["game_log"] = list(state.game_log)[-50:]

        return snapshot


game_engine = GameEngine()
