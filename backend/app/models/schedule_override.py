import uuid
from datetime import date, time
from sqlalchemy import String, SmallInteger, ForeignKey, Date, Time, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.subject import Subject

class ScheduleOverride(Base):
    """
    Model representing a temporal lesson override specifically for a single calendar date.
    Allows changing a lesson or setting a substitute teacher/subject for one week without
    modifying recurring master schedule rules.
    """
    __tablename__ = "schedule_overrides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    lesson_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    
    # The substitute / changed subject for this specific day
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    
    # The original subject that was scheduled before the substitution
    original_subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    original_subject_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    cabinet: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Special event / assessment type: control_work, test, essay, project, or None (regular)
    event_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    subject: Mapped["Subject | None"] = relationship("Subject", foreign_keys=[subject_id], lazy="selectin")
    original_subject: Mapped["Subject | None"] = relationship("Subject", foreign_keys=[original_subject_id], lazy="selectin")

    __table_args__ = (
        UniqueConstraint("date", "lesson_order", name="uq_schedule_override_date_order"),
    )
