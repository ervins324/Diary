import logging
from datetime import datetime, date
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models.subject import Subject
from app.models.schedule_rule import ScheduleRule
from app.models.bell_schedule import BellSchedule
from app.models.homework import HomeworkEntry

logger = logging.getLogger("school_diary.system")
router = APIRouter(prefix="/api/v1/system", tags=["system"])


class BackupSubjectItem(BaseModel):
    id: str | None = None
    name: str
    short_name: str | None = None
    color_hex: str | None = None
    default_cabinet: str | None = None


class BackupBellItem(BaseModel):
    id: str | None = None
    lesson_order: int
    start_time: str
    end_time: str
    name: str | None = None


class BackupScheduleRuleItem(BaseModel):
    id: str | None = None
    subject_id: str | None = None
    subject_name: str | None = None
    day_of_week: int
    week_type: str
    lesson_order: int
    start_time: str
    end_time: str
    cabinet: str | None = None


class BackupHomeworkItem(BaseModel):
    id: str | None = None
    subject_id: str | None = None
    subject_name: str | None = None
    due_date: str
    lesson_order: int | None = None
    text: str
    is_completed: bool = False
    images: list[str] = Field(default_factory=list)


class FullBackupData(BaseModel):
    version: str = "1.6.0"
    exported_at: str | None = None
    subjects: list[BackupSubjectItem] = Field(default_factory=list)
    bell_schedules: list[BackupBellItem] = Field(default_factory=list)
    schedule_rules: list[BackupScheduleRuleItem] = Field(default_factory=list)
    homeworks: list[BackupHomeworkItem] = Field(default_factory=list)


@router.get("/backup/export")
async def export_full_backup(db: AsyncSession = Depends(get_db)):
    """
    Export all application data into a single unified JSON backup:
    - Subjects
    - Bell schedules (Розклад дзвінків)
    - Schedule rules (Уроки)
    - Homework entries (including images and completion status)
    """
    try:
        # 1. Fetch all subjects
        subj_res = await db.execute(select(Subject).order_by(Subject.name))
        subjects = subj_res.scalars().all()
        subjects_data = [
            {
                "id": str(s.id),
                "name": s.name,
                "short_name": s.short_name,
                "color_hex": s.color_hex,
                "default_cabinet": s.default_cabinet,
            }
            for s in subjects
        ]

        # 2. Fetch all bell schedules
        bells_res = await db.execute(select(BellSchedule).order_by(BellSchedule.lesson_order))
        bells = bells_res.scalars().all()
        bells_data = [
            {
                "id": str(b.id),
                "lesson_order": b.lesson_order,
                "start_time": b.start_time,
                "end_time": b.end_time,
                "name": b.name,
            }
            for b in bells
        ]

        # 3. Fetch all schedule rules
        rules_res = await db.execute(
            select(ScheduleRule).order_by(ScheduleRule.week_type, ScheduleRule.day_of_week, ScheduleRule.lesson_order)
        )
        rules = rules_res.scalars().all()
        rules_data = [
            {
                "id": str(r.id),
                "subject_id": str(r.subject_id),
                "day_of_week": r.day_of_week,
                "week_type": r.week_type,
                "lesson_order": r.lesson_order,
                "start_time": r.start_time,
                "end_time": r.end_time,
                "cabinet": r.cabinet,
            }
            for r in rules
        ]

        # 4. Fetch all homework entries
        hw_res = await db.execute(select(HomeworkEntry).order_by(HomeworkEntry.due_date))
        homeworks = hw_res.scalars().all()
        hw_data = [
            {
                "id": str(h.id),
                "subject_id": str(h.subject_id),
                "due_date": h.due_date.isoformat() if isinstance(h.due_date, (date, datetime)) else str(h.due_date),
                "lesson_order": h.lesson_order,
                "text": h.text,
                "is_completed": h.is_completed,
                "images": h.images or [],
            }
            for h in homeworks
        ]

        return {
            "version": "1.6.0",
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "subjects": subjects_data,
            "bell_schedules": bells_data,
            "schedule_rules": rules_data,
            "homeworks": hw_data,
        }
    except Exception as e:
        logger.exception(f"Failed to export backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export backup: {str(e)}")


@router.post("/backup/import", status_code=status.HTTP_200_OK)
async def import_full_backup(backup: FullBackupData, db: AsyncSession = Depends(get_db)):
    """
    Restore application state from a JSON backup.
    Performs an atomic transaction:
    1. Wipes existing homework, schedule rules, bell schedules, and subjects.
    2. Restores subjects with mapped IDs.
    3. Restores bell schedules.
    4. Restores schedule rules.
    5. Restores homework entries with attached images.
    """
    try:
        logger.info(
            f"Importing backup: {len(backup.subjects)} subjects, {len(backup.bell_schedules)} bells, "
            f"{len(backup.schedule_rules)} rules, {len(backup.homeworks)} homeworks"
        )

        # Step 1: Wipe existing records in safe foreign-key order
        await db.execute(delete(HomeworkEntry))
        await db.execute(delete(ScheduleRule))
        await db.execute(delete(BellSchedule))
        await db.execute(delete(Subject))
        await db.flush()

        # Map to track original subject ID -> new Subject UUID
        subject_id_map: dict[str, UUID] = {}
        subject_name_map: dict[str, UUID] = {}

        # Step 2: Insert Subjects
        for s_item in backup.subjects:
            try:
                subj_uuid = UUID(s_item.id) if s_item.id else uuid4()
            except (ValueError, TypeError):
                subj_uuid = uuid4()

            subj = Subject(
                id=subj_uuid,
                name=s_item.name,
                short_name=s_item.short_name,
                color_hex=s_item.color_hex or "#6366F1",
                default_cabinet=s_item.default_cabinet,
            )
            db.add(subj)
            if s_item.id:
                subject_id_map[str(s_item.id)] = subj_uuid
            subject_name_map[s_item.name.strip().lower()] = subj_uuid

        await db.flush()

        # Step 3: Insert Bell Schedules
        for b_item in backup.bell_schedules:
            try:
                b_uuid = UUID(b_item.id) if b_item.id else uuid4()
            except (ValueError, TypeError):
                b_uuid = uuid4()

            bell = BellSchedule(
                id=b_uuid,
                lesson_order=b_item.lesson_order,
                start_time=b_item.start_time,
                end_time=b_item.end_time,
                name=b_item.name,
            )
            db.add(bell)

        await db.flush()

        # Step 4: Insert Schedule Rules
        imported_rules_count = 0
        for r_item in backup.schedule_rules:
            # Resolve subject_id
            target_subject_id: UUID | None = None
            if r_item.subject_id and str(r_item.subject_id) in subject_id_map:
                target_subject_id = subject_id_map[str(r_item.subject_id)]
            elif r_item.subject_name and r_item.subject_name.strip().lower() in subject_name_map:
                target_subject_id = subject_name_map[r_item.subject_name.strip().lower()]

            if not target_subject_id:
                logger.warning(f"Skipping schedule rule with unresolved subject: {r_item}")
                continue

            try:
                r_uuid = UUID(r_item.id) if r_item.id else uuid4()
            except (ValueError, TypeError):
                r_uuid = uuid4()

            rule = ScheduleRule(
                id=r_uuid,
                subject_id=target_subject_id,
                day_of_week=r_item.day_of_week,
                week_type=r_item.week_type,
                lesson_order=r_item.lesson_order,
                start_time=r_item.start_time,
                end_time=r_item.end_time,
                cabinet=r_item.cabinet,
            )
            db.add(rule)
            imported_rules_count += 1

        await db.flush()

        # Step 5: Insert Homework Entries
        imported_hw_count = 0
        for h_item in backup.homeworks:
            # Resolve subject_id
            target_subject_id: UUID | None = None
            if h_item.subject_id and str(h_item.subject_id) in subject_id_map:
                target_subject_id = subject_id_map[str(h_item.subject_id)]
            elif h_item.subject_name and h_item.subject_name.strip().lower() in subject_name_map:
                target_subject_id = subject_name_map[h_item.subject_name.strip().lower()]

            if not target_subject_id:
                logger.warning(f"Skipping homework entry with unresolved subject: {h_item}")
                continue

            try:
                h_uuid = UUID(h_item.id) if h_item.id else uuid4()
            except (ValueError, TypeError):
                h_uuid = uuid4()

            # Parse due_date
            try:
                parsed_due_date = date.fromisoformat(h_item.due_date)
            except ValueError:
                parsed_due_date = date.today()

            hw = HomeworkEntry(
                id=h_uuid,
                subject_id=target_subject_id,
                due_date=parsed_due_date,
                lesson_order=h_item.lesson_order,
                text=h_item.text,
                is_completed=h_item.is_completed,
                images=h_item.images or [],
            )
            db.add(hw)
            imported_hw_count += 1

        await db.commit()

        return {
            "status": "ok",
            "message": "Backup imported and applied successfully",
            "imported": {
                "subjects": len(backup.subjects),
                "bell_schedules": len(backup.bell_schedules),
                "schedule_rules": imported_rules_count,
                "homeworks": imported_hw_count,
            },
        }

    except Exception as e:
        await db.rollback()
        logger.exception(f"Failed to import backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import backup: {str(e)}")
