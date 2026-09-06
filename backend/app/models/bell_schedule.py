import uuid
from datetime import time
from sqlalchemy import SmallInteger, Time, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class BellSchedule(Base):
    """
    Model representing a lesson bell schedule slot (розклад дзвінків).
    Defines the start and end time for each lesson order.
    """
    __tablename__ = "bell_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_order: Mapped[int] = mapped_column(SmallInteger, unique=True, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    name: Mapped[str | None] = mapped_column(String(50), nullable=True)
