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
