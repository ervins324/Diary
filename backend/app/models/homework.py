import uuid
from datetime import date
from sqlalchemy import String, SmallInteger, ForeignKey, Date, Text, Boolean
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

    subject: Mapped["Subject"] = relationship("Subject", lazy="selectin")
