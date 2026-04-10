"""Players router — avatar upload, profile."""

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import PLAYER_AVATARS_DIR, MAX_AVATAR_SIZE, ALLOWED_AVATAR_EXTENSIONS
from backend.database import get_db
from backend.models.tables import Session
from backend.schemas.schemas import AvatarResponse, PlayerProfile

router = APIRouter(prefix="/api/players", tags=["players"])


@router.post("/avatar", response_model=AvatarResponse)
async def upload_avatar(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        raise HTTPException(400, f"File type not allowed. Allowed: {ALLOWED_AVATAR_EXTENSIONS}")

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(400, f"File too large. Max {MAX_AVATAR_SIZE // (1024*1024)} MB")

    # Sanitize filename — use session_id only
    safe_filename = f"{session_id}{ext}"
    filepath = PLAYER_AVATARS_DIR / safe_filename

    # Ensure directory exists
    PLAYER_AVATARS_DIR.mkdir(parents=True, exist_ok=True)

    # Remove old avatars for this session
    for old_file in PLAYER_AVATARS_DIR.glob(f"{session_id}.*"):
        old_file.unlink(missing_ok=True)

    # Save file
    with open(filepath, "wb") as f:
        f.write(content)

    avatar_url = f"/static/player_avatars/{safe_filename}"

    # Update session
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session:
        session.avatar_url = avatar_url
    else:
        session = Session(id=session_id, avatar_url=avatar_url)
        db.add(session)
    await db.commit()

    return AvatarResponse(avatar_url=avatar_url)


@router.get("/{session_id}", response_model=PlayerProfile)
async def get_player_profile(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    return PlayerProfile(
        session_id=session.id,
        nickname=session.nickname,
        avatar_url=session.avatar_url,
    )
