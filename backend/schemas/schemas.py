from datetime import datetime
from pydantic import BaseModel, Field


# ---------- Table ----------

class TableCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    type: str = Field(..., pattern=r"^(cash|tournament)$")
    blind_small: int = Field(..., gt=0)
    blind_big: int = Field(..., gt=0)
    time_per_move: int = Field(30, ge=5, le=120)
    time_bank: int = Field(90, ge=0, le=600)
    dealer_type: str = Field("robot", pattern=r"^(robot|frol|danilka)$")
    min_buyin: int | None = None
    max_buyin: int | None = None
    starting_stack: int | None = None
    tournament_blind_interval: int | None = Field(None, ge=1)


class TableCreated(BaseModel):
    table_id: str
    invite_code: str


class TableSummary(BaseModel):
    id: str
    name: str
    type: str
    players_count: int
    max_players: int
    blind_small: int
    status: str


class PlayerInfo(BaseModel):
    id: str
    session_id: str
    nickname: str
    avatar_url: str | None
    seat_index: int
    stack: int
    time_bank: int
    status: str
    is_admin: bool


class TableDetail(BaseModel):
    id: str
    invite_code: str
    name: str
    admin_session_id: str
    type: str
    dealer_type: str
    blind_small: int
    blind_big: int
    time_per_move: int
    time_bank_max: int
    min_buyin: int | None
    max_buyin: int | None
    starting_stack: int | None
    tournament_blind_interval: int | None
    status: str
    players: list[PlayerInfo]


# ---------- Join / Leave ----------

class JoinTable(BaseModel):
    session_id: str
    nickname: str = Field(..., min_length=1, max_length=20)
    buyin: int = Field(..., gt=0)


class JoinResult(BaseModel):
    player_id: str
    seat_index: int


class LeaveTable(BaseModel):
    session_id: str


class CashoutRequest(BaseModel):
    session_id: str


# ---------- Actions ----------

class GameAction(BaseModel):
    session_id: str
    action: str = Field(..., pattern=r"^(fold|check|call|raise|allin)$")
    amount: int | None = None


class StartGame(BaseModel):
    session_id: str


# ---------- Rebuy ----------

class RebuyRequest(BaseModel):
    session_id: str
    amount: int = Field(..., gt=0)


class RebuyApprove(BaseModel):
    session_id: str
    target_player_id: str
    amount: int = Field(..., gt=0)


class RebuyDeny(BaseModel):
    session_id: str
    target_player_id: str


# ---------- Social ----------

class TipPlayer(BaseModel):
    session_id: str
    target_player_id: str
    amount: int = Field(..., gt=0)


class AccuseStalling(BaseModel):
    session_id: str
    target_player_id: str


class RevealCard(BaseModel):
    session_id: str
    card_index: int = Field(..., ge=0, le=1)


class AwayStatus(BaseModel):
    session_id: str
    away: bool


# ---------- Frol ----------

class KickPlayer(BaseModel):
    session_id: str  # admin's session
    target_player_id: str


class FrolTip(BaseModel):
    session_id: str
    amount: int = Field(..., ge=0)


class FrolDecline(BaseModel):
    session_id: str


class ChangeDealerType(BaseModel):
    session_id: str
    dealer_type: str = Field(..., pattern=r"^(robot|frol|danilka)$")


# ---------- Avatar ----------

class AvatarResponse(BaseModel):
    avatar_url: str


class PlayerProfile(BaseModel):
    session_id: str
    nickname: str | None
    avatar_url: str | None


# ---------- Health ----------

class HealthResponse(BaseModel):
    status: str
    version: str


# ---------- Generic ----------

class OkResponse(BaseModel):
    ok: bool = True


class ActionResponse(BaseModel):
    ok: bool = True
    raced: bool = False
    game_state_snapshot: dict | None = None


class RebuyRequestResponse(BaseModel):
    ok: bool = True
    request_id: str


class AccuseStallingResponse(BaseModel):
    ok: bool = True
    new_time_bank: int


class FrolDeclineResponse(BaseModel):
    ok: bool = True
    declined: bool = True
    reason: str | None = None


class ErrorResponse(BaseModel):
    detail: str
