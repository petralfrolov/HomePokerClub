"""
Rebuy service for managing chip rebuy requests and approvals.
"""

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("poker.rebuy")


@dataclass
class RebuyRequestData:
    request_id: str
    table_id: str
    player_id: str
    session_id: str
    amount: int
    status: str = "pending"  # pending, approved, denied


class RebuyManager:
    def __init__(self) -> None:
        self._requests: dict[str, RebuyRequestData] = {}  # request_id -> data
        self._counter = 0

    def create_request(self, table_id: str, player_id: str, session_id: str, amount: int) -> RebuyRequestData:
        self._counter += 1
        request_id = f"rebuy_{self._counter}"
        req = RebuyRequestData(
            request_id=request_id,
            table_id=table_id,
            player_id=player_id,
            session_id=session_id,
            amount=amount,
        )
        self._requests[request_id] = req
        return req

    def get_request_by_player(self, table_id: str, player_id: str) -> RebuyRequestData | None:
        for req in self._requests.values():
            if req.table_id == table_id and req.player_id == player_id and req.status == "pending":
                return req
        return None

    def approve(self, request_id: str) -> RebuyRequestData | None:
        req = self._requests.get(request_id)
        if req and req.status == "pending":
            req.status = "approved"
            return req
        return None

    def deny(self, request_id: str) -> RebuyRequestData | None:
        req = self._requests.get(request_id)
        if req and req.status == "pending":
            req.status = "denied"
            return req
        return None

    def clear_table(self, table_id: str) -> None:
        to_remove = [k for k, v in self._requests.items() if v.table_id == table_id]
        for k in to_remove:
            del self._requests[k]


rebuy_manager = RebuyManager()
