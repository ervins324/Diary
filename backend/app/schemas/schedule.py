import uuid
from datetime import time, date
from pydantic import BaseModel, ConfigDict
from app.schemas.subject import SubjectRead
from app.schemas.homework import HomeworkRead

class ScheduleRuleCreate(BaseModel):
    subject_id: uuid.UUID
    day_of_week: int
    week_type: str = "all"
    lesson_order: int
    start_time: time
    end_time: time
    cabinet: str | None = None

class ScheduleRuleRead(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    day_of_week: int
    week_type: str
    lesson_order: int
    start_time: time
    end_time: time
    cabinet: str | None
    subject: SubjectRead

    model_config = ConfigDict(from_attributes=True)

class LessonSlot(BaseModel):
    date: date
    lesson_order: int
    subject: SubjectRead
    start_time: time
    end_time: time
    cabinet: str | None
    homework: list[HomeworkRead] | None = None

class DaySchedule(BaseModel):
    date: date
    day_name: str
    week_type: str
    lessons: list[LessonSlot]

class BulkCommitRequest(BaseModel):
    week_type: str
    rules: list[ScheduleRuleCreate]

class AiParsedLesson(BaseModel):
    order: int
    subject_name: str
    start_time: str
    end_time: str
    cabinet: str | None = None

class AiParsedDay(BaseModel):
    day_of_week: int
    day_name: str
    lessons: list[AiParsedLesson]

class AiParseResponse(BaseModel):
    days: list[AiParsedDay]


# ── Bulk commit by subject name (used by AI import flow) ─────
class BulkCommitByNameRule(BaseModel):
    """A schedule rule referencing a subject by name instead of ID."""
    subject_name: str
    day_of_week: int
    lesson_order: int
    start_time: time
    end_time: time
    cabinet: str | None = None


class BulkCommitByNameRequest(BaseModel):
    """Request body for bulk-commit-by-name endpoint."""
    week_type: str
    rules: list[BulkCommitByNameRule]
