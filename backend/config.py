import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR / 'data' / 'poker.db'}")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

AVATARS_DIR = BASE_DIR / "data" / "avatars"
PLAYER_AVATARS_DIR = BASE_DIR / "data" / "player_avatars"

MAX_AVATAR_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

MAX_PLAYERS_PER_TABLE = 9

APP_VERSION = "1.0.0"

# ---- Game engine tuning ----
DANILKA_EVENT_CHANCE = 0.05          # probability of Danilka strong-hands event per hand
DANILKA_MAX_DEAL_ATTEMPTS = 50       # max retries for unique Danilka cards per player
DEFAULT_TIME_BANK = 90               # default time bank in seconds per player
GAME_LOG_MAX_ENTRIES = 100           # max entries in game action log (deque)

# ---- Frol tip mechanics ----
FROL_TIP_TIMEOUT = 15               # seconds to respond to tip request
FROL_DEFAULT_TIP_PERCENT = 5        # auto-tip percentage on timeout
FROL_MIN_TIP_PERCENT = 1            # minimum tip percentage
FROL_MAX_TIP_PERCENT = 10           # maximum tip percentage
FROL_TIP_STEP = 1                   # tip slider step
FROL_TIP_WAIT_SECONDS = 20          # max seconds to wait for tip resolution

# ---- Post-hand timing ----
SHOWDOWN_DELAY = 5                   # seconds before next hand after showdown
FOLD_WIN_DELAY = 2                   # seconds before next hand after fold-win
DANILKA_RESTART_DELAY = 3            # seconds before restart after danilka cancel

# ---- Rebuy window ----
REBUY_WINDOW_TIMEOUT = 20            # seconds for bust players to request rebuy

# ---- Stalling ----
STALLING_TIME_BANK_PENALTY = 0      # time bank reduced to this on accusation

# ---- Lobby ----
INVITE_CODE_BYTES = 6                # bytes for token_urlsafe invite code
DEFAULT_TOURNAMENT_BLIND_INTERVAL = 10
DEFAULT_TOURNAMENT_BLIND_MULTIPLIER = 1.5

# ---- Background tasks ----
IDLE_TABLE_CLEANUP_INTERVAL = 300    # seconds between idle-table checks
IDLE_TABLE_TIMEOUT_MINUTES = 60      # minutes before an idle table is deleted

# ---- Rate limiting ----
ACTION_RATE_LIMIT = 5                # max /action requests per window
ACTION_RATE_WINDOW = 2.0             # rate limit window in seconds
