import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

class LessonNoteCreate(BaseModel):
    subject_id: uuid.UUID
    date: date
    lesson_order: int
    text: str

class LessonNoteUpdate(BaseModel):
    text: str

class LessonNoteRead(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    date: date
    lesson_order: int
    text: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
