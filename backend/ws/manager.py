import asyncio
import json
import logging
import time
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("poker.ws")

# Connection is considered stale if no frames received for this long.
STALE_AFTER_SECONDS = 5 * 60
CLEANUP_INTERVAL_SECONDS = 60


class ConnectionManager:
    """Manages WebSocket connections grouped by table_id."""

    def __init__(self) -> None:
        # table_id -> {session_id -> WebSocket}
        self._connections: dict[str, dict[str, WebSocket]] = {}
        # table_id -> {session_id -> last_heartbeat_monotonic}
        self._last_seen: dict[str, dict[str, float]] = {}

    async def connect(self, table_id: str, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        # If the same session already has a socket (e.g. reconnect without clean close),
        # evict the stale one so we don't broadcast to a dead peer.
        table_conns = self._connections.setdefault(table_id, {})
        prev = table_conns.get(session_id)
        if prev is not None and prev is not ws:
            try:
                await prev.close()
            except Exception:
                pass
        table_conns[session_id] = ws
        self._last_seen.setdefault(table_id, {})[session_id] = time.monotonic()
        logger.info("WS connected: table=%s session=%s", table_id, session_id)

    def touch(self, table_id: str, session_id: str) -> None:
        """Record a heartbeat for this connection."""
        self._last_seen.setdefault(table_id, {})[session_id] = time.monotonic()

    def disconnect(self, table_id: str, session_id: str, ws: WebSocket | None = None) -> None:
        """Remove a session's connection.

        If `ws` is provided, only remove when the currently-stored socket is the same
        instance. This prevents a stale disconnect (from an evicted old socket) from
        evicting a freshly-connected replacement socket for the same session.
        """
        table_conns = self._connections.get(table_id)
        if table_conns:
            stored = table_conns.get(session_id)
            if stored is not None and (ws is None or stored is ws):
                table_conns.pop(session_id, None)
                if not table_conns:
                    del self._connections[table_id]
                seen = self._last_seen.get(table_id)
                if seen:
                    seen.pop(session_id, None)
                    if not seen:
                        self._last_seen.pop(table_id, None)
                logger.info("WS disconnected: table=%s session=%s", table_id, session_id)
            else:
                # A stale socket announced disconnect after being replaced. Ignore.
                logger.debug(
                    "WS disconnect ignored (stale socket): table=%s session=%s", table_id, session_id
                )

    async def _drop_dead(self, table_id: str, session_id: str, ws: WebSocket) -> None:
        """Close and remove a socket that failed to send."""
        try:
            await ws.close()
        except Exception:
            pass
        self.disconnect(table_id, session_id, ws)

    async def send_personal(self, table_id: str, session_id: str, event: str, data: dict[str, Any]) -> None:
        table_conns = self._connections.get(table_id, {})
        ws = table_conns.get(session_id)
        if ws:
            try:
                await ws.send_text(json.dumps({"event": event, **data}))
            except Exception:
                logger.warning("Failed to send personal message to %s; dropping connection", session_id)
                await self._drop_dead(table_id, session_id, ws)

    async def broadcast(self, table_id: str, event: str, data: dict[str, Any], exclude: str | None = None) -> None:
        table_conns = self._connections.get(table_id, {})
        message = json.dumps({"event": event, **data})
        dead: list[tuple[str, WebSocket]] = []
        for sid, ws in list(table_conns.items()):
            if sid == exclude:
                continue
            try:
                await ws.send_text(message)
            except Exception:
                logger.warning("Failed to broadcast to %s; marking dead", sid)
                dead.append((sid, ws))
        for sid, ws in dead:
            await self._drop_dead(table_id, sid, ws)

    async def broadcast_all(self, table_id: str, event: str, data: dict[str, Any]) -> None:
        await self.broadcast(table_id, event, data)

    def get_connection_count(self, table_id: str) -> int:
        return len(self._connections.get(table_id, {}))

    async def server_ping_once(self) -> None:
        """Send a server-initiated ping to every connection; updates liveness view."""
        payload = json.dumps({"type": "ping"})
        for table_id, conns in list(self._connections.items()):
            for sid, ws in list(conns.items()):
                try:
                    await ws.send_text(payload)
                except Exception:
                    await self._drop_dead(table_id, sid, ws)

    async def cleanup_stale_once(self) -> None:
        """Close connections that haven't produced a frame for STALE_AFTER_SECONDS."""
        now = time.monotonic()
        for table_id, seen in list(self._last_seen.items()):
            for sid, ts in list(seen.items()):
                if now - ts > STALE_AFTER_SECONDS:
                    ws = self._connections.get(table_id, {}).get(sid)
                    if ws is not None:
                        logger.info("WS stale cleanup: table=%s session=%s", table_id, sid)
                        await self._drop_dead(table_id, sid, ws)
                    else:
                        seen.pop(sid, None)

    async def run_maintenance_loop(self) -> None:
        """Periodic task: ping + stale cleanup. Call from app lifespan."""
        try:
            while True:
                await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
                try:
                    await self.server_ping_once()
                    await self.cleanup_stale_once()
                except Exception:
                    logger.exception("WS maintenance loop iteration failed")
        except asyncio.CancelledError:
            pass


manager = ConnectionManager()
