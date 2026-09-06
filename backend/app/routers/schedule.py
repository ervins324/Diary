import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.config import settings
from app.models.schedule_rule import ScheduleRule, WeekType
from app.models.subject import Subject
import json
from app.models.bell_schedule import BellSchedule
from app.schemas.schedule import (
    DaySchedule, AiParseResponse, BulkCommitRequest,
    ScheduleRuleCreate, ScheduleRuleRead, BulkCommitByNameRequest, BulkCommitByNameRule,
    get_default_bell_times, JsonScheduleParseRequest,
)
import logging
from app.services.schedule_service import get_schedule_for_range
from app.services.ai_parser import parse_schedule_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/schedule", tags=["schedule"])


@router.get("", response_model=list[DaySchedule])
@router.get("/", response_model=list[DaySchedule], include_in_schema=False)
async def get_schedule(
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the schedule for a date range.
    Determines week type per day and returns lessons with homework.
    """
    anchor_date = date.fromisoformat(settings.SEMESTER_ANCHOR_DATE)
    return await get_schedule_for_range(db, start_date, end_date, anchor_date)


@router.post("/ai-parse", response_model=AiParseResponse)
async def ai_parse(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Parse a schedule image using Gemini 3.5 Flash AI.
    Returns structured JSON for client-side review — does NOT write to DB.
    Missing lesson times are populated from the bell_schedules table (if available),
    falling back to hardcoded defaults when no bells exist in the database.
    """
    logger.info(f"POST /api/v1/schedule/ai-parse received file: '{file.filename}' (content_type={file.content_type})")
    image_bytes = await file.read()
    if not image_bytes:
        logger.warning("Empty file uploaded to /ai-parse")
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    logger.info(f"Read {len(image_bytes)} bytes for schedule image. Calling AI parser...")
    result = await parse_schedule_image(
        image_bytes=image_bytes,
        filename=file.filename or "upload.jpg",
        api_key=settings.GEMINI_API_KEY,
        content_type=file.content_type,
    )
    logger.info(f"Successfully parsed schedule image: extracted {len(result.days)} day(s)")

    # Enrich missing lesson times using DB bells or hardcoded fallback
    return await apply_bell_times_fallback(result, db)


async def apply_bell_times_fallback(result: AiParseResponse, db: AsyncSession) -> AiParseResponse:
    """
    Helper function to fill in missing lesson start_time and end_time
    using the bell_schedules table if configured, otherwise falling back to standard hardcoded bell times.
    """
    # Query imported bell schedule from database to use as time fallback
    bell_stmt = select(BellSchedule).order_by(BellSchedule.lesson_order)
    bell_result = await db.execute(bell_stmt)
    bell_rows = bell_result.scalars().all()

    # Build lesson_order → (start_time, end_time) lookup from DB bells
    db_bell_times: dict[int, tuple[str, str]] = {}
    for bell in bell_rows:
        db_bell_times[bell.lesson_order] = (
            bell.start_time.strftime("%H:%M"),
            bell.end_time.strftime("%H:%M"),
        )

    bell_source = "database" if db_bell_times else "hardcoded defaults"
    logger.info(f"Bell schedule fallback source: {bell_source} ({len(db_bell_times)} slots from DB)")

    # Post-process: fill missing start_time/end_time using DB bells → hardcoded fallback
    for day in result.days:
        for lesson in day.lessons:
            if not lesson.start_time or not lesson.start_time.strip():
                if lesson.order in db_bell_times:
                    lesson.start_time = db_bell_times[lesson.order][0]
                else:
                    lesson.start_time = get_default_bell_times(lesson.order)[0]
            if not lesson.end_time or not lesson.end_time.strip():
                if lesson.order in db_bell_times:
                    lesson.end_time = db_bell_times[lesson.order][1]
                else:
                    lesson.end_time = get_default_bell_times(lesson.order)[1]

    return result


@router.post("/parse-json", response_model=AiParseResponse)
async def parse_schedule_json(
    request: JsonScheduleParseRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Parse a JSON string representing schedule days and lessons,
    typically obtained from an external AI (ChatGPT, Claude, Gemini Web, etc.).
    Validates structure, enriches missing bell times from database, and returns
    for client review without requiring a backend GEMINI_API_KEY.
    """
    raw_text = request.raw_json.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Empty JSON payload received")

    # Strip markdown code fences if wrapped in ```json ... ``` or ``` ... ```
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    elif raw_text.startswith("```"):
        raw_text = raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]
    raw_text = raw_text.strip()

    # Parse JSON
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to decode JSON from request: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid JSON format: {str(e)}"
        )

    # Normalize if the top-level object is a list of days: [{"day_of_week": ...}]
    if isinstance(data, list):
        data = {"days": data}

    if not isinstance(data, dict) or "days" not in data:
        raise HTTPException(
            status_code=422,
            detail="JSON structure must contain a 'days' array with lesson details."
        )

    # Validate against Pydantic schema
    try:
        validated = AiParseResponse.model_validate(data)
    except Exception as e:
        logger.warning(f"Validation failed for user-submitted schedule JSON: {e}")
        raise HTTPException(
            status_code=422,
            detail=f"Schedule JSON validation error: {str(e)}"
        )

    # Enrich missing lesson times from bell_schedules table
    return await apply_bell_times_fallback(validated, db)



@router.post("/bulk-commit", status_code=status.HTTP_200_OK)
async def bulk_commit(request: BulkCommitRequest, db: AsyncSession = Depends(get_db)):
    """
    Bulk replace schedule rules for a given week type using subject IDs.
    Deletes all existing rules for the target week_type, then inserts the new set.
    """
    # Delete existing rules for this week_type
    stmt = delete(ScheduleRule).where(ScheduleRule.week_type == request.week_type)
    await db.execute(stmt)

    # Insert new rules, verifying each subject exists
    for rule_in in request.rules:
        subject = await db.get(Subject, rule_in.subject_id)
        if not subject:
            await db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Subject {rule_in.subject_id} not found",
            )

        rule = ScheduleRule(
            subject_id=rule_in.subject_id,
            day_of_week=rule_in.day_of_week,
            week_type=request.week_type,
            lesson_order=rule_in.lesson_order,
            start_time=rule_in.start_time,
            end_time=rule_in.end_time,
            cabinet=rule_in.cabinet,
        )
        db.add(rule)

    await db.commit()
    return {"status": "ok", "message": f"Successfully updated schedule for {request.week_type}"}


# Canonical Ukrainian subject short names and color palette
UKRAINIAN_SUBJECT_SHORT_NAMES: dict[str, tuple[str, str]] = {
    "українська мова": ("Укр мова", "#3B82F6"),
    "укр мова": ("Укр мова", "#3B82F6"),
    "українська література": ("Укр літ", "#8B5CF6"),
    "укр літ": ("Укр літ", "#8B5CF6"),
    "англійська мова": ("Англ мова", "#EC4899"),
    "англ мова": ("Англ мова", "#EC4899"),
    "іноземна мова": ("Іноз мова", "#EC4899"),
    "фізична культура": ("Фізра", "#10B981"),
    "фізра": ("Фізра", "#10B981"),
    "фізкультура": ("Фізра", "#10B981"),
    "фіз культура": ("Фіз культура", "#10B981"),
    "зарубіжна література": ("Зар літ", "#F59E0B"),
    "зар літ": ("Зар літ", "#F59E0B"),
    "всесвітня історія": ("Всесв іст", "#D97706"),
    "історія україни": ("Іст України", "#B45309"),
    "інформатика": ("Інформ", "#06B6D4"),
    "інформ": ("Інформ", "#06B6D4"),
    "геометрія": ("Геом", "#6366F1"),
    "алгебра": ("Алг", "#4F46E5"),
    "математика": ("Матем", "#4F46E5"),
    "біологія": ("Біол", "#14B8A6"),
    "хімія": ("Хім", "#EF4444"),
    "фізика": ("Фіз", "#84CC16"),
    "географія": ("Геогр", "#EAB308"),
    "мистецтво": ("Мистецтво", "#A855F7"),
    "образотворче мистецтво": ("Мистецтво", "#A855F7"),
    "трудове навчання": ("Труд навч", "#64748B"),
    "основи здоров'я": ("Осн здор", "#22C55E"),
}


@router.post("/bulk-commit-by-name", status_code=status.HTTP_200_OK)
async def bulk_commit_by_name(
    request: BulkCommitByNameRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Bulk replace schedule rules using subject NAMES instead of IDs.
    Auto-creates subjects that don't exist yet (used by the AI import flow).
    """
    # Delete existing rules for this week_type
    stmt = delete(ScheduleRule).where(ScheduleRule.week_type == request.week_type)
    await db.execute(stmt)

    # Cache of subject name -> Subject ORM instance (avoids repeated queries)
    subject_cache: dict[str, Subject] = {}

    for rule_in in request.rules:
        subject_name = rule_in.subject_name.strip()

        # Look up or create the subject
        if subject_name not in subject_cache:
            result = await db.execute(
                select(Subject).where(Subject.name == subject_name)
            )
            existing = result.scalar_one_or_none()

            if existing:
                subject_cache[subject_name] = existing
            else:
                # Determine smart short name and color for common Ukrainian subjects
                name_clean = subject_name.lower()
                short_name = subject_name[:10]
                color = "#6B7280"

                for key, (canonical_short, canonical_color) in UKRAINIAN_SUBJECT_SHORT_NAMES.items():
                    if key in name_clean or name_clean in key:
                        short_name = canonical_short
                        color = canonical_color
                        break

                # Auto-create the subject with sensible defaults
                new_subject = Subject(
                    name=subject_name,
                    short_name=short_name,
                    color_hex=color,
                    default_cabinet=rule_in.cabinet,
                )
                db.add(new_subject)
                await db.flush()  # Flush to get the generated ID
                subject_cache[subject_name] = new_subject

        subject = subject_cache[subject_name]

        rule = ScheduleRule(
            subject_id=subject.id,
            day_of_week=rule_in.day_of_week,
            week_type=request.week_type,
            lesson_order=rule_in.lesson_order,
            start_time=rule_in.start_time,
            end_time=rule_in.end_time,
            cabinet=rule_in.cabinet,
        )
        db.add(rule)

    await db.commit()

    # Return the list of subjects that were auto-created (useful for the frontend)
    return {
        "status": "ok",
        "message": f"Successfully updated schedule for {request.week_type}",
        "subjects_created": [
            {"name": s.name, "id": str(s.id)}
            for s in subject_cache.values()
        ],
    }


@router.get("/rules", response_model=list[ScheduleRuleRead])
async def list_schedule_rules(
    week_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all schedule rules (raw), optionally filtered by week_type.
    """
    stmt = select(ScheduleRule).order_by(ScheduleRule.day_of_week, ScheduleRule.lesson_order)
    if week_type:
        stmt = stmt.where(ScheduleRule.week_type == week_type)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("", status_code=status.HTTP_200_OK)
@router.delete("/", status_code=status.HTTP_200_OK, include_in_schema=False)
async def delete_all_schedule(
    week_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete schedule rules. If week_type is provided, delete only for that week_type,
    otherwise delete ALL schedule rules.
    """
    stmt = delete(ScheduleRule)
    if week_type:
        stmt = stmt.where(ScheduleRule.week_type == week_type)
    await db.execute(stmt)
    await db.commit()
    return {"status": "ok", "message": "Schedule deleted successfully"}

