import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.config import settings
from app.models.schedule_rule import ScheduleRule, WeekType
from app.models.subject import Subject
from app.schemas.schedule import (
    DaySchedule, AiParseResponse, BulkCommitRequest,
    ScheduleRuleCreate, BulkCommitByNameRequest, BulkCommitByNameRule,
)
from app.services.schedule_service import get_schedule_for_range
from app.services.ai_parser import parse_schedule_image

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
async def ai_parse(file: UploadFile = File(...)):
    """
    Parse a schedule image using Gemini 2.0 Flash AI.
    Returns structured JSON for client-side review — does NOT write to DB.
    """
    image_bytes = await file.read()
    return await parse_schedule_image(image_bytes, file.filename or "upload.jpg", settings.GEMINI_API_KEY)


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
                # Auto-create the subject with sensible defaults
                new_subject = Subject(
                    name=subject_name,
                    short_name=subject_name[:10],  # Truncate to max length
                    color_hex="#6B7280",  # Neutral gray default
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
