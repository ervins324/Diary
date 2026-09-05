import uuid
from datetime import date
from pydantic import BaseModel, ConfigDict
from app.schemas.subject import SubjectRead

class HomeworkCreate(BaseModel):
    subject_id: uuid.UUID
    due_date: date
    lesson_order: int | None = None
    text: str

class HomeworkUpdate(BaseModel):
    text: str | None = None
    is_completed: bool | None = None
    lesson_order: int | None = None

class HomeworkRead(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    due_date: date
    lesson_order: int | None
    text: str
    is_completed: bool
    subject: SubjectRead

    model_config = ConfigDict(from_attributes=True)
