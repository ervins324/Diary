import uuid
import enum
from datetime import time
from sqlalchemy import String, SmallInteger, ForeignKey, Enum, UniqueConstraint, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.subject import Subject

class WeekType(str, enum.Enum):
    all = "all"
    numerator = "numerator"
    denominator = "denominator"

class ScheduleRule(Base):
    """
    Model representing a rule for a scheduled lesson.
    """
    __tablename__ = "schedule_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1-7
    week_type: Mapped[WeekType] = mapped_column(Enum(WeekType), default=WeekType.all, nullable=False)
    lesson_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    cabinet: Mapped[str | None] = mapped_column(String(20), nullable=True)

    subject: Mapped["Subject"] = relationship("Subject", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("day_of_week", "week_type", "lesson_order", name="uq_schedule_rule_day_week_order"),
    )
