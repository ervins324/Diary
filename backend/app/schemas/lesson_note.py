import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

class LessonNoteCreate(BaseModel):
    subject_id: uuid.UUID
    date: date
    lesson_order: int
    text: str
    images: list[str] | None = None
    attachments: list[dict] | None = None

class LessonNoteUpdate(BaseModel):
    text: str | None = None
    images: list[str] | None = None
    attachments: list[dict] | None = None

class LessonNoteRead(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    date: date
    lesson_order: int
    text: str
    images: list[str] | None = None
    attachments: list[dict] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
