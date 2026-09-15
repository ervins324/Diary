import uuid
from datetime import date, datetime
from sqlalchemy import String, SmallInteger, Integer, ForeignKey, Date, DateTime, Text, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.subject import Subject

class HomeworkEntry(Base):
    """
    Model representing a homework assignment.
    """
    __tablename__ = "homeworks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    lesson_order: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Indicates whether the homework was failed/unprepared in class resulting in a bad mark
    is_failed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    images: Mapped[list[str] | None] = mapped_column(JSON, default=list, nullable=True)
    attachments: Mapped[list[dict] | None] = mapped_column(JSON, default=list, nullable=True)
    # Total time spent on this homework in seconds (tracked via stopwatch)
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subject: Mapped["Subject"] = relationship("Subject", lazy="selectin")

