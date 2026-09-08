import uuid
from datetime import date
from pydantic import BaseModel, ConfigDict
from app.schemas.subject import SubjectRead

class AttachmentItem(BaseModel):
    id: str | None = None
    name: str
    type: str  # 'image' | 'pdf' | 'presentation' | 'link'
    url: str
    size: int | None = None

class HomeworkCreate(BaseModel):
    subject_id: uuid.UUID
    due_date: date
    lesson_order: int | None = None
    text: str
    images: list[str] = []
    attachments: list[AttachmentItem] = []
    time_spent_seconds: int | None = 0

class HomeworkUpdate(BaseModel):
    text: str | None = None
    is_completed: bool | None = None
    lesson_order: int | None = None
    images: list[str] | None = None
    attachments: list[AttachmentItem] | None = None
    time_spent_seconds: int | None = None

class HomeworkRead(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    due_date: date
    lesson_order: int | None
    text: str
    is_completed: bool
    images: list[str] | None = []
    attachments: list[AttachmentItem] | None = []
    time_spent_seconds: int | None = 0
    subject: SubjectRead

    model_config = ConfigDict(from_attributes=True)

