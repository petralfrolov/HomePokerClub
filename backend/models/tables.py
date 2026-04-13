import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    nickname: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Table(Base):
    __tablename__ = "tables"

    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    invite_code: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    admin_session_id: Mapped[str] = mapped_column(Text, ForeignKey("sessions.id"))
    type: Mapped[str] = mapped_column(Text)  # cash / tournament
    dealer_type: Mapped[str] = mapped_column(Text, default="robot")
    blind_small: Mapped[int] = mapped_column(Integer)
    blind_big: Mapped[int] = mapped_column(Integer)
    time_per_move: Mapped[int] = mapped_column(Integer, default=30)
    time_bank_max: Mapped[int] = mapped_column(Integer, default=90)
    min_buyin: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_buyin: Mapped[int | None] = mapped_column(Integer, nullable=True)
    starting_stack: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tournament_blind_interval: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="waiting")
    round_number: Mapped[int] = mapped_column(Integer, default=0)
    dealer_seat_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    players: Mapped[list["Player"]] = relationship(back_populates="table", lazy="selectin")
    rounds: Mapped[list["GameRound"]] = relationship(back_populates="table", lazy="selectin")


class Player(Base):
    __tablename__ = "players"

    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(Text, ForeignKey("sessions.id"))
    table_id: Mapped[str] = mapped_column(Text, ForeignKey("tables.id"))
    nickname: Mapped[str] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    seat_index: Mapped[int] = mapped_column(Integer)
    stack: Mapped[int] = mapped_column(Integer)
    time_bank: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, default="active")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    table: Mapped["Table"] = relationship(back_populates="players")


class GameRound(Base):
    __tablename__ = "game_rounds"

    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    table_id: Mapped[str] = mapped_column(Text, ForeignKey("tables.id"))
    round_number: Mapped[int] = mapped_column(Integer)
    dealer_seat: Mapped[int] = mapped_column(Integer)
    community_cards: Mapped[str] = mapped_column(Text, default="[]")
    pot: Mapped[int] = mapped_column(Integer, default=0)
    winner_ids: Mapped[str] = mapped_column(Text, default="[]")
    danilka_event: Mapped[bool] = mapped_column(Boolean, default=False)
    stage: Mapped[str] = mapped_column(Text, default="preflop")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    table: Mapped["Table"] = relationship(back_populates="rounds")
    actions: Mapped[list["RoundAction"]] = relationship(back_populates="round", lazy="selectin")


class RoundAction(Base):
    __tablename__ = "round_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[str] = mapped_column(Text, ForeignKey("game_rounds.id"))
    player_id: Mapped[str] = mapped_column(Text, ForeignKey("players.id"))
    action: Mapped[str] = mapped_column(Text)
    amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stage: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    round: Mapped["GameRound"] = relationship(back_populates="actions")
