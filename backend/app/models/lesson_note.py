import uuid
from datetime import date, datetime
from sqlalchemy import SmallInteger, ForeignKey, Date, Text, DateTime, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.subject import Subject

class LessonNote(Base):
    """
    Model representing a student note for a specific lesson slot on a calendar date.
    A single lesson can have multiple distinct notes (e.g. class notes, reminders, lecture points).
    """
    __tablename__ = "lesson_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    lesson_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    subject: Mapped["Subject"] = relationship("Subject", lazy="selectin")

    __table_args__ = (
        Index("ix_lesson_notes_date_order", "date", "lesson_order"),
    )
