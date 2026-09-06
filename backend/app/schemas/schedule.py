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

# Default standard lesson bell schedule used when timetable images lack explicit time stamps
DEFAULT_BELL_TIMES: dict[int, tuple[str, str]] = {
    1: ("08:30", "09:15"),
    2: ("09:25", "10:10"),
    3: ("10:25", "11:10"),
    4: ("11:25", "12:10"),
    5: ("12:25", "13:10"),
    6: ("13:25", "14:10"),
    7: ("14:20", "15:05"),
    8: ("15:15", "16:00"),
    9: ("16:10", "16:55"),
    10: ("17:05", "17:50"),
}

def get_default_bell_times(order: int) -> tuple[str, str]:
    """Helper to return fallback bell times based on lesson order."""
    if order in DEFAULT_BELL_TIMES:
        return DEFAULT_BELL_TIMES[order]
    base_hour = min(8 + (order - 1), 22)
    return (f"{base_hour:02d}:00", f"{base_hour:02d}:45")

class AiParsedLesson(BaseModel):
    order: int
    subject_name: str
    start_time: str | None = None
    end_time: str | None = None
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
