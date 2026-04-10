"""
Timer service for managing turn timers and time banks.
Uses asyncio tasks for server-side countdown.
"""

import asyncio
import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger("poker.timer")


class TurnTimer:
    """Manages a single player's turn timer with time bank support."""

    def __init__(
        self,
        table_id: str,
        player_id: str,
        time_limit: int,
        time_bank: int,
        on_timeout: Callable[[], Awaitable[None]],
        on_time_bank_start: Callable[[], Awaitable[None]] | None = None,
    ):
        self.table_id = table_id
        self.player_id = player_id
        self.time_limit = time_limit
        self.time_bank = time_bank
        self.on_timeout = on_timeout
        self.on_time_bank_start = on_time_bank_start
        self._task: asyncio.Task | None = None
        self._using_time_bank = False

    def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    def cancel(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None

    def reduce_time_bank(self, new_value: int) -> None:
        self.time_bank = new_value

    @property
    def remaining_time_bank(self) -> int:
        return self.time_bank

    async def _run(self) -> None:
        try:
            # Main timer
            await asyncio.sleep(self.time_limit)

            # Switch to time bank
            self._using_time_bank = True
            if self.on_time_bank_start:
                await self.on_time_bank_start()

            # Time bank countdown (1 second intervals for updates)
            while self.time_bank > 0:
                await asyncio.sleep(1)
                self.time_bank -= 1

            # Fire on_timeout as an INDEPENDENT task so that cancellation of this
            # timer task (e.g. player submitted action just as timer expired) does
            # NOT kill the on_timeout coroutine mid-execution, leaving game state
            # mutated but un-broadcast.
            asyncio.ensure_future(self.on_timeout())

        except asyncio.CancelledError:
            pass  # Timer cancelled normally because player acted in time
        except Exception:
            logger.exception("Timer error for player %s at table %s", self.player_id, self.table_id)


class TimerManager:
    """Manages all active turn timers."""

    def __init__(self) -> None:
        self._timers: dict[str, TurnTimer] = {}  # table_id -> TurnTimer

    def start_timer(
        self,
        table_id: str,
        player_id: str,
        time_limit: int,
        time_bank: int,
        on_timeout: Callable[[], Awaitable[None]],
        on_time_bank_start: Callable[[], Awaitable[None]] | None = None,
    ) -> TurnTimer:
        self.cancel_timer(table_id)
        timer = TurnTimer(
            table_id=table_id,
            player_id=player_id,
            time_limit=time_limit,
            time_bank=time_bank,
            on_timeout=on_timeout,
            on_time_bank_start=on_time_bank_start,
        )
        self._timers[table_id] = timer
        timer.start()
        return timer

    def cancel_timer(self, table_id: str) -> None:
        timer = self._timers.pop(table_id, None)
        if timer:
            timer.cancel()

    def get_timer(self, table_id: str) -> TurnTimer | None:
        return self._timers.get(table_id)


timer_manager = TimerManager()
