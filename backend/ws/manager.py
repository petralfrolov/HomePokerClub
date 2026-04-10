import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("poker.ws")


class ConnectionManager:
    """Manages WebSocket connections grouped by table_id."""

    def __init__(self) -> None:
        # table_id -> {session_id -> WebSocket}
        self._connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, table_id: str, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(table_id, {})[session_id] = ws
        logger.info("WS connected: table=%s session=%s", table_id, session_id)

    def disconnect(self, table_id: str, session_id: str) -> None:
        table_conns = self._connections.get(table_id)
        if table_conns:
            table_conns.pop(session_id, None)
            if not table_conns:
                del self._connections[table_id]
        logger.info("WS disconnected: table=%s session=%s", table_id, session_id)

    async def send_personal(self, table_id: str, session_id: str, event: str, data: dict[str, Any]) -> None:
        table_conns = self._connections.get(table_id, {})
        ws = table_conns.get(session_id)
        if ws:
            try:
                await ws.send_text(json.dumps({"event": event, **data}))
            except Exception:
                logger.warning("Failed to send personal message to %s", session_id)

    async def broadcast(self, table_id: str, event: str, data: dict[str, Any], exclude: str | None = None) -> None:
        table_conns = self._connections.get(table_id, {})
        message = json.dumps({"event": event, **data})
        for sid, ws in list(table_conns.items()):
            if sid == exclude:
                continue
            try:
                await ws.send_text(message)
            except Exception:
                logger.warning("Failed to broadcast to %s", sid)

    async def broadcast_all(self, table_id: str, event: str, data: dict[str, Any]) -> None:
        await self.broadcast(table_id, event, data)

    def get_connection_count(self, table_id: str) -> int:
        return len(self._connections.get(table_id, {}))


manager = ConnectionManager()
