"""
Shtos service — manages "штос" (head-to-head card gambling) offers between two
players at a poker table, and per-player blocks against unwanted offers.

Lifecycle of an offer:
    pending -> accepted -> resolved
    pending -> declined
    pending -> expired (not enforced server-side; clients may auto-decline)

After accept: a random one of the two players becomes the "picker", and is shown
the deck. They click a card. The server then deals from the shuffled remaining
deck alternately into two piles starting with the opposite (banker) side; the
first card whose rank matches the picker's chosen rank decides the winner.
If the matching card lands on the picker's pile first → picker wins, otherwise
the opponent wins. Result is resolved server-side and broadcast for animation.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

# Standard 52-card deck encoded as 2-char strings: rank + suit (treys-compatible)
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]
SUITS = ["s", "h", "d", "c"]
FULL_DECK: list[str] = [r + s for r in RANKS for s in SUITS]


def card_rank(card: str) -> str:
    return card[0]


@dataclass
class ShtosResolution:
    deck_sequence: list[str]      # full 52 cards in dealing order (after picker draw)
    picker_pile: list[str]        # cards dealt to picker side
    banker_pile: list[str]        # cards dealt to banker (opponent) side
    matching_card: str            # first card matching picker's rank
    matching_pile: str            # "picker" or "banker"
    matching_index: int           # index in deck_sequence (0-based)
    winner_id: str
    loser_id: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "deck_sequence": self.deck_sequence,
            "picker_pile": self.picker_pile,
            "banker_pile": self.banker_pile,
            "matching_card": self.matching_card,
            "matching_pile": self.matching_pile,
            "matching_index": self.matching_index,
            "winner_id": self.winner_id,
            "loser_id": self.loser_id,
        }


@dataclass
class ShtosOffer:
    offer_id: str
    table_id: str
    initiator_id: str        # player_id of proposer
    initiator_session: str
    target_id: str           # player_id of responder
    target_session: str
    amount: int
    status: str = "pending"  # pending | accepted | declined | resolved
    picker_id: str | None = None        # player_id chosen randomly on accept
    picked_card: str | None = None       # card picked by picker (rank+suit)
    resolution: ShtosResolution | None = None


class ShtosManager:
    def __init__(self) -> None:
        self._offers: dict[str, ShtosOffer] = {}
        # blocks[blocker_session_id] = set of blocked player_ids (per-table is
        # implicit — player_ids are unique within the lifetime of a server run).
        self._blocks: dict[str, set[str]] = {}
        self._counter = 0

    # ---- offers ----

    def create_offer(
        self,
        table_id: str,
        initiator_id: str,
        initiator_session: str,
        target_id: str,
        target_session: str,
        amount: int,
    ) -> ShtosOffer:
        self._counter += 1
        offer_id = f"shtos_{self._counter}"
        offer = ShtosOffer(
            offer_id=offer_id,
            table_id=table_id,
            initiator_id=initiator_id,
            initiator_session=initiator_session,
            target_id=target_id,
            target_session=target_session,
            amount=amount,
        )
        self._offers[offer_id] = offer
        return offer

    def get(self, offer_id: str) -> ShtosOffer | None:
        return self._offers.get(offer_id)

    def get_pending_between(
        self, table_id: str, player_a_id: str, player_b_id: str
    ) -> ShtosOffer | None:
        for o in self._offers.values():
            if o.table_id != table_id or o.status != "pending":
                continue
            ids = {o.initiator_id, o.target_id}
            if ids == {player_a_id, player_b_id}:
                return o
        return None

    def accept(self, offer_id: str) -> ShtosOffer | None:
        o = self._offers.get(offer_id)
        if not o or o.status != "pending":
            return None
        o.status = "accepted"
        # randomly choose picker
        o.picker_id = random.choice([o.initiator_id, o.target_id])
        return o

    def decline(self, offer_id: str) -> ShtosOffer | None:
        o = self._offers.get(offer_id)
        if not o or o.status != "pending":
            return None
        o.status = "declined"
        return o

    def cancel(self, offer_id: str) -> ShtosOffer | None:
        """Terminate a pending offer without applying any auto-block.

        Used both for the initiator's manual cancel and for the 20-second
        timeout — neither should incur the punitive block that an explicit
        decline triggers.
        """
        o = self._offers.get(offer_id)
        if not o or o.status != "pending":
            return None
        o.status = "cancelled"
        return o

    def resolve(self, offer_id: str, picked_card: str) -> ShtosOffer | None:
        """Pick the card and compute the resolution deterministically.

        The full 52-card deck (including the picked card itself) is shuffled
        and dealt alternately into two piles starting with the banker.  The
        very first card whose rank AND suit match the picked card decides the
        winner: whoever's pile receives it wins.
        """
        o = self._offers.get(offer_id)
        if not o or o.status != "accepted" or o.picker_id is None:
            return None
        if picked_card not in FULL_DECK:
            return None

        deck = list(FULL_DECK)
        random.shuffle(deck)

        picker_pile: list[str] = []
        banker_pile: list[str] = []
        matching_card: str | None = None
        matching_pile: str | None = None
        matching_index: int = -1

        for i, card in enumerate(deck):
            if i % 2 == 0:
                banker_pile.append(card)
                pile_label = "banker"
            else:
                picker_pile.append(card)
                pile_label = "picker"
            if card == picked_card:
                matching_card = card
                matching_pile = pile_label
                matching_index = i
                break

        # Defensive: should always match because picked_card is in deck.
        if matching_card is None:
            matching_card = deck[-1]
            matching_pile = "banker" if (len(deck) - 1) % 2 == 0 else "picker"
            matching_index = len(deck) - 1

        if matching_pile == "picker":
            winner_id = o.picker_id
            loser_id = o.target_id if o.picker_id == o.initiator_id else o.initiator_id
        else:
            loser_id = o.picker_id
            winner_id = o.target_id if o.picker_id == o.initiator_id else o.initiator_id

        o.picked_card = picked_card
        o.resolution = ShtosResolution(
            deck_sequence=deck[: matching_index + 1],
            picker_pile=picker_pile,
            banker_pile=banker_pile,
            matching_card=matching_card,
            matching_pile=matching_pile,
            matching_index=matching_index,
            winner_id=winner_id,
            loser_id=loser_id,
        )
        o.status = "resolved"
        return o

    def clear_table(self, table_id: str) -> None:
        for k in [k for k, v in self._offers.items() if v.table_id == table_id]:
            del self._offers[k]

    # ---- blocks ----

    def set_block(self, blocker_session: str, blocked_player_id: str, blocked: bool) -> None:
        s = self._blocks.setdefault(blocker_session, set())
        if blocked:
            s.add(blocked_player_id)
        else:
            s.discard(blocked_player_id)

    def is_blocked(self, blocker_session: str, blocked_player_id: str) -> bool:
        return blocked_player_id in self._blocks.get(blocker_session, set())

    def get_blocks(self, blocker_session: str) -> list[str]:
        return sorted(self._blocks.get(blocker_session, set()))


shtos_manager = ShtosManager()
