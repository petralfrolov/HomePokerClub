"""
Dealer behavior service.
Handles Danilka events and Frol tip mechanics.
"""

import random
import logging
from typing import Any

logger = logging.getLogger("poker.dealer")

FROL_TIP_TIMEOUT = 15  # seconds
FROL_DEFAULT_TIP_PERCENT = 5  # auto-tip if timeout

# Frol decline button types
DECLINE_FLYING = "flying"
DECLINE_INVISIBLE = "invisible"
DECLINE_TRICK = "trick"
FROL_DECLINE_TYPES = [DECLINE_FLYING, DECLINE_INVISIBLE, DECLINE_TRICK]


def should_trigger_danilka_event() -> bool:
    return random.random() < 0.05


def get_frol_tip_request(pot: int, winner_id: str) -> dict[str, Any]:
    decline_type = random.choice(FROL_DECLINE_TYPES)
    return {
        "event": "frol_tip_request",
        "pot": pot,
        "winner_id": winner_id,
        "decline_button_type": decline_type,
        "tip_timeout": FROL_TIP_TIMEOUT,
        "min_tip_percent": 2,
        "max_tip_percent": 10,
        "tip_step": 1,
    }


def calculate_frol_tip(pot: int, percent: int) -> int:
    clamped = max(2, min(10, percent))
    return (pot * clamped) // 100


def handle_frol_decline(decline_type: str, pot: int) -> dict[str, Any]:
    """Handle Frol decline button press."""
    if decline_type == DECLINE_TRICK:
        # Trick button: user actually tips 5%
        tip_amount = pot * FROL_DEFAULT_TIP_PERCENT // 100
        return {
            "declined": False,
            "reason": "trick_button",
            "tip_amount": tip_amount,
        }
    # Flying and invisible: real decline
    return {
        "declined": True,
        "tip_amount": 0,
    }


def get_frol_auto_tip(pot: int) -> int:
    """Auto-tip when timeout expires."""
    return calculate_frol_tip(pot, FROL_DEFAULT_TIP_PERCENT)
