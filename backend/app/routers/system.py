import logging
from datetime import datetime, date, time
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

import base64
from app.database import get_db
from app.models.subject import Subject
from app.models.schedule_rule import ScheduleRule
from app.models.bell_schedule import BellSchedule
from app.models.homework import HomeworkEntry
from app.models.stored_file import StoredFile
from app.models.schedule_override import ScheduleOverride
from app.models.lesson_note import LessonNote
from app.models.holiday import Holiday

logger = logging.getLogger("school_diary.system")
router = APIRouter(prefix="/api/v1/system", tags=["system"])


def parse_time_str(val: str | time | None, default_hour: int = 8, default_minute: int = 30) -> time:
    """Safely converts string ('08:30:00', '08:30') or time object into a datetime.time object."""
    if val is None:
        return time(hour=default_hour, minute=default_minute)
    if isinstance(val, time):
        return val
    try:
        val_str = str(val).strip()
        parts = val_str.split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        s = int(parts[2].split(".")[0]) if len(parts) > 2 else 0
        return time(hour=h, minute=m, second=s)
    except Exception as err:
        logger.warning(f"Failed to parse time string '{val}', falling back to default: {err}")
        return time(hour=default_hour, minute=default_minute)


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
    is_failed: bool = False
    time_spent_seconds: int = 0
    assigned_date: str | None = None
    created_at: str | None = None
    images: list[str] = Field(default_factory=list)
    attachments: list[dict] = Field(default_factory=list)


class BackupScheduleOverrideItem(BaseModel):
    id: str | None = None
    date: str
    lesson_order: int
    subject_id: str | None = None
    original_subject_id: str | None = None
    original_subject_name: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    cabinet: str | None = None
    is_cancelled: bool = False
    note: str | None = None
    event_type: str | None = None


class BackupStoredFileItem(BaseModel):
    id: str | None = None
    filename: str
    content_type: str
    size: int
    file_data_base64: str


class BackupLessonNoteItem(BaseModel):
    id: str | None = None
    subject_id: str | None = None
    subject_name: str | None = None
    date: str
    lesson_order: int
    text: str
    images: list[str] = Field(default_factory=list)
    attachments: list[dict] = Field(default_factory=list)


class BackupHolidayItem(BaseModel):
    id: str | None = None
    name: str
    start_date: str
    end_date: str


class FullBackupData(BaseModel):
    version: str = "1.7.0"
    exported_at: str | None = None
    subjects: list[BackupSubjectItem] = Field(default_factory=list)
    bell_schedules: list[BackupBellItem] = Field(default_factory=list)
    schedule_rules: list[BackupScheduleRuleItem] = Field(default_factory=list)
    homeworks: list[BackupHomeworkItem] = Field(default_factory=list)
    schedule_overrides: list[BackupScheduleOverrideItem] = Field(default_factory=list)
    stored_files: list[BackupStoredFileItem] = Field(default_factory=list)
    lesson_notes: list[BackupLessonNoteItem] = Field(default_factory=list)
    holidays: list[BackupHolidayItem] = Field(default_factory=list)


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
                "is_failed": getattr(h, "is_failed", False),
                "time_spent_seconds": getattr(h, "time_spent_seconds", 0) or 0,
                "assigned_date": h.assigned_date.isoformat() if getattr(h, "assigned_date", None) else None,
                "created_at": h.created_at.isoformat() if getattr(h, "created_at", None) else None,
                "images": h.images or [],
                "attachments": h.attachments or [],
            }
            for h in homeworks
        ]

        # 5. Fetch all temporal schedule overrides
        ov_res = await db.execute(select(ScheduleOverride).order_by(ScheduleOverride.date, ScheduleOverride.lesson_order))
        overrides = ov_res.scalars().all()
        overrides_data = [
            {
                "id": str(o.id),
                "date": o.date.isoformat() if isinstance(o.date, (date, datetime)) else str(o.date),
                "lesson_order": o.lesson_order,
                "subject_id": str(o.subject_id) if o.subject_id else None,
                "original_subject_id": str(o.original_subject_id) if o.original_subject_id else None,
                "original_subject_name": o.original_subject_name,
                "start_time": o.start_time.strftime("%H:%M:%S") if o.start_time else None,
                "end_time": o.end_time.strftime("%H:%M:%S") if o.end_time else None,
                "cabinet": o.cabinet,
                "is_cancelled": o.is_cancelled,
                "note": o.note,
                "event_type": o.event_type,
            }
            for o in overrides
        ]

        # 6. Fetch all stored files
        files_res = await db.execute(select(StoredFile).order_by(StoredFile.created_at))
        files = files_res.scalars().all()
        files_data = [
            {
                "id": str(f.id),
                "filename": f.filename,
                "content_type": f.content_type,
                "size": f.size,
                "file_data_base64": base64.b64encode(f.file_data).decode("utf-8"),
            }
            for f in files
        ]

        # 7. Fetch all lesson notes
        notes_res = await db.execute(select(LessonNote).order_by(LessonNote.date, LessonNote.lesson_order))
        notes = notes_res.scalars().all()
        notes_data = [
            {
                "id": str(n.id),
                "subject_id": str(n.subject_id),
                "date": n.date.isoformat() if isinstance(n.date, (date, datetime)) else str(n.date),
                "lesson_order": n.lesson_order,
                "text": n.text,
                "images": n.images or [],
                "attachments": n.attachments or [],
            }
            for n in notes
        ]

        # 8. Fetch all holidays
        holidays_res = await db.execute(select(Holiday).order_by(Holiday.start_date))
        holidays = holidays_res.scalars().all()
        holidays_data = [
            {
                "id": str(hol.id),
                "name": hol.name,
                "start_date": hol.start_date.isoformat() if isinstance(hol.start_date, (date, datetime)) else str(hol.start_date),
                "end_date": hol.end_date.isoformat() if isinstance(hol.end_date, (date, datetime)) else str(hol.end_date),
            }
            for hol in holidays
        ]

        return {
            "version": "1.7.5",
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "subjects": subjects_data,
            "bell_schedules": bells_data,
            "schedule_rules": rules_data,
            "homeworks": hw_data,
            "schedule_overrides": overrides_data,
            "stored_files": files_data,
            "lesson_notes": notes_data,
            "holidays": holidays_data,
        }
    except Exception as e:
        logger.exception(f"Failed to export backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export backup: {str(e)}")


@router.post("/backup/import", status_code=status.HTTP_200_OK)
async def import_full_backup(backup: FullBackupData, db: AsyncSession = Depends(get_db)):
    """
    Restore application state from a JSON backup.
    Performs an atomic transaction:
    1. Wipes existing homework, overrides, schedule rules, bell schedules, stored files, and subjects.
    2. Restores stored files.
    3. Restores subjects with mapped IDs.
    4. Restores bell schedules.
    5. Restores schedule rules.
    6. Restores schedule overrides.
    7. Restores homework entries with attachments and images.
    """
    try:
        logger.info(
            f"Importing backup: {len(backup.subjects)} subjects, {len(backup.bell_schedules)} bells, "
            f"{len(backup.schedule_rules)} rules, {len(backup.homeworks)} homeworks, "
            f"{len(backup.schedule_overrides)} overrides, {len(backup.stored_files)} files"
        )

        # Step 1: Wipe existing records in safe foreign-key order
        await db.execute(delete(LessonNote))
        await db.execute(delete(Holiday))
        await db.execute(delete(HomeworkEntry))
        await db.execute(delete(ScheduleOverride))
        await db.execute(delete(ScheduleRule))
        await db.execute(delete(BellSchedule))
        await db.execute(delete(StoredFile))
        await db.execute(delete(Subject))
        await db.flush()

        # Step 2: Insert Stored Files
        for f_item in backup.stored_files:
            try:
                f_uuid = UUID(f_item.id) if f_item.id else uuid4()
            except (ValueError, TypeError):
                f_uuid = uuid4()

            raw_bytes = base64.b64decode(f_item.file_data_base64) if f_item.file_data_base64 else b""
            sf = StoredFile(
                id=f_uuid,
                filename=f_item.filename,
                content_type=f_item.content_type,
                size=f_item.size or len(raw_bytes),
                file_data=raw_bytes,
            )
            db.add(sf)

        await db.flush()

        # Map to track original subject ID -> new Subject UUID
        subject_id_map: dict[str, UUID] = {}
        subject_name_map: dict[str, UUID] = {}

        # Step 3: Insert Subjects
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

        # Step 4: Insert Bell Schedules
        for b_item in backup.bell_schedules:
            try:
                b_uuid = UUID(b_item.id) if b_item.id else uuid4()
            except (ValueError, TypeError):
                b_uuid = uuid4()

            bell = BellSchedule(
                id=b_uuid,
                lesson_order=b_item.lesson_order,
                start_time=parse_time_str(b_item.start_time, default_hour=8, default_minute=30),
                end_time=parse_time_str(b_item.end_time, default_hour=9, default_minute=15),
                name=b_item.name,
            )
            db.add(bell)

        await db.flush()

        # Step 5: Insert Schedule Rules
        imported_rules_count = 0
        for r_item in backup.schedule_rules:
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
                start_time=parse_time_str(r_item.start_time, default_hour=8, default_minute=30),
                end_time=parse_time_str(r_item.end_time, default_hour=9, default_minute=15),
                cabinet=r_item.cabinet,
            )
            db.add(rule)
            imported_rules_count += 1

        await db.flush()

        # Step 6: Insert Schedule Overrides
        imported_overrides_count = 0
        for ov_item in backup.schedule_overrides:
            subj_id = subject_id_map.get(str(ov_item.subject_id)) if ov_item.subject_id else None
            orig_subj_id = subject_id_map.get(str(ov_item.original_subject_id)) if ov_item.original_subject_id else None

            try:
                ov_uuid = UUID(ov_item.id) if ov_item.id else uuid4()
            except (ValueError, TypeError):
                ov_uuid = uuid4()

            try:
                ov_date = date.fromisoformat(ov_item.date)
            except ValueError:
                continue

            override = ScheduleOverride(
                id=ov_uuid,
                date=ov_date,
                lesson_order=ov_item.lesson_order,
                subject_id=subj_id,
                original_subject_id=orig_subj_id,
                original_subject_name=ov_item.original_subject_name,
                start_time=parse_time_str(ov_item.start_time) if ov_item.start_time else None,
                end_time=parse_time_str(ov_item.end_time) if ov_item.end_time else None,
                cabinet=ov_item.cabinet,
                is_cancelled=ov_item.is_cancelled,
                note=ov_item.note,
                event_type=ov_item.event_type,
            )
            db.add(override)
            imported_overrides_count += 1

        await db.flush()

        # Step 7: Insert Homework Entries
        imported_hw_count = 0
        for h_item in backup.homeworks:
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

            try:
                parsed_due_date = date.fromisoformat(h_item.due_date)
            except ValueError:
                parsed_due_date = date.today()

            assigned_d = None
            if getattr(h_item, "assigned_date", None):
                try:
                    assigned_d = date.fromisoformat(h_item.assigned_date)
                except ValueError:
                    assigned_d = None

            hw = HomeworkEntry(
                id=h_uuid,
                subject_id=target_subject_id,
                due_date=parsed_due_date,
                lesson_order=h_item.lesson_order,
                text=h_item.text,
                is_completed=h_item.is_completed,
                is_failed=getattr(h_item, "is_failed", False),
                time_spent_seconds=getattr(h_item, "time_spent_seconds", 0) or 0,
                assigned_date=assigned_d,
                images=h_item.images or [],
                attachments=h_item.attachments or [],
            )
            db.add(hw)
            imported_hw_count += 1

        await db.flush()

        # Step 8: Insert Lesson Notes
        imported_notes_count = 0
        for n_item in getattr(backup, "lesson_notes", []) or []:
            target_subject_id: UUID | None = None
            if n_item.subject_id and str(n_item.subject_id) in subject_id_map:
                target_subject_id = subject_id_map[str(n_item.subject_id)]
            elif n_item.subject_name and n_item.subject_name.strip().lower() in subject_name_map:
                target_subject_id = subject_name_map[n_item.subject_name.strip().lower()]

            if not target_subject_id:
                continue

            try:
                n_uuid = UUID(n_item.id) if n_item.id else uuid4()
            except (ValueError, TypeError):
                n_uuid = uuid4()

            try:
                parsed_date = date.fromisoformat(n_item.date)
            except ValueError:
                parsed_date = date.today()

            note = LessonNote(
                id=n_uuid,
                subject_id=target_subject_id,
                date=parsed_date,
                lesson_order=n_item.lesson_order,
                text=n_item.text,
                images=getattr(n_item, "images", []) or [],
                attachments=getattr(n_item, "attachments", []) or [],
            )
            db.add(note)
            imported_notes_count += 1

        # Step 9: Insert Holidays
        imported_holidays_count = 0
        for hol_item in getattr(backup, "holidays", []) or []:
            try:
                hol_uuid = UUID(hol_item.id) if hol_item.id else uuid4()
            except (ValueError, TypeError):
                hol_uuid = uuid4()

            try:
                s_date = date.fromisoformat(hol_item.start_date)
                e_date = date.fromisoformat(hol_item.end_date)
            except ValueError:
                continue

            holiday_entry = Holiday(
                id=hol_uuid,
                name=hol_item.name,
                start_date=s_date,
                end_date=e_date,
            )
            db.add(holiday_entry)
            imported_holidays_count += 1

        await db.commit()

        return {
            "status": "ok",
            "message": "Backup imported and applied successfully",
            "imported": {
                "subjects": len(backup.subjects),
                "bell_schedules": len(backup.bell_schedules),
                "schedule_rules": imported_rules_count,
                "homeworks": imported_hw_count,
                "schedule_overrides": imported_overrides_count,
                "stored_files": len(backup.stored_files),
                "lesson_notes": imported_notes_count,
                "holidays": imported_holidays_count,
            },
        }

    except Exception as e:
        await db.rollback()
        logger.exception(f"Failed to import backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import backup: {str(e)}")


class CleanDataRequest(BaseModel):
    """
    Request model for selective or time-step based data cleanup.
    Allows deleting data strictly before a cutoff date or within a specific date range,
    with options for cleaning homework, overrides, completed homework only, or orphaned files.
    """
    before_date: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    clean_homework: bool = True
    clean_completed_homework_only: bool = False
    clean_schedule_overrides: bool = True
    clean_orphaned_files: bool = True


@router.post("/clean-data", status_code=status.HTTP_200_OK)
async def clean_data(
    req: CleanDataRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete data for specific time steps / ranges or clean historical records.
    """
    deleted_homework_count = 0
    deleted_overrides_count = 0
    deleted_files_count = 0

    parsed_before: date | None = None
    parsed_start: date | None = None
    parsed_end: date | None = None

    if req.before_date:
        try:
            parsed_before = date.fromisoformat(req.before_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid before_date format (expected YYYY-MM-DD)")

    if req.start_date:
        try:
            parsed_start = date.fromisoformat(req.start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format (expected YYYY-MM-DD)")

    if req.end_date:
        try:
            parsed_end = date.fromisoformat(req.end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format (expected YYYY-MM-DD)")

    # 1. Clean Homework
    if req.clean_homework:
        hw_stmt = delete(HomeworkEntry)
        conditions = []
        if parsed_before:
            conditions.append(HomeworkEntry.due_date < parsed_before)
        if parsed_start:
            conditions.append(HomeworkEntry.due_date >= parsed_start)
        if parsed_end:
            conditions.append(HomeworkEntry.due_date <= parsed_end)
        if req.clean_completed_homework_only:
            conditions.append(HomeworkEntry.is_completed == True)

        if conditions:
            for cond in conditions:
                hw_stmt = hw_stmt.where(cond)
            hw_res = await db.execute(hw_stmt)
            deleted_homework_count = hw_res.rowcount or 0

    # 2. Clean Schedule Overrides
    if req.clean_schedule_overrides:
        ov_stmt = delete(ScheduleOverride)
        ov_conditions = []
        if parsed_before:
            ov_conditions.append(ScheduleOverride.date < parsed_before)
        if parsed_start:
            ov_conditions.append(ScheduleOverride.date >= parsed_start)
        if parsed_end:
            ov_conditions.append(ScheduleOverride.date <= parsed_end)

        if ov_conditions:
            for cond in ov_conditions:
                ov_stmt = ov_stmt.where(cond)
            ov_res = await db.execute(ov_stmt)
            deleted_overrides_count = ov_res.rowcount or 0

    # 3. Clean Orphaned Stored Files
    if req.clean_orphaned_files:
        # Query all active homework and lesson note attachments to find referenced file IDs
        hw_all = await db.execute(select(HomeworkEntry.attachments))
        active_file_ids: set[str] = set()
        for attachments_list in hw_all.scalars().all():
            if attachments_list:
                for att in attachments_list:
                    if isinstance(att, dict) and att.get("id"):
                        active_file_ids.add(str(att["id"]))

        notes_all = await db.execute(select(LessonNote.attachments))
        for attachments_list in notes_all.scalars().all():
            if attachments_list:
                for att in attachments_list:
                    if isinstance(att, dict) and att.get("id"):
                        active_file_ids.add(str(att["id"]))

        # Query all files
        all_files_res = await db.execute(select(StoredFile))
        all_files = all_files_res.scalars().all()
        for sf in all_files:
            if str(sf.id) not in active_file_ids:
                # If before_date was specified, check sf.created_at
                if parsed_before:
                    sf_date = sf.created_at.date() if sf.created_at else None
                    if sf_date and sf_date >= parsed_before:
                        continue
                await db.delete(sf)
                deleted_files_count += 1

    await db.commit()

    return {
        "status": "ok",
        "message": "Cleanup executed successfully",
        "deleted": {
            "homework": deleted_homework_count,
            "schedule_overrides": deleted_overrides_count,
            "stored_files": deleted_files_count,
        },
    }


@router.get("/storage-stats")
async def get_storage_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns estimated storage consumption (in bytes) and record counts
    for each type of data stored in PostgreSQL:
    - Stored files (PDF, PPT/PPTX, images)
    - Homework entries
    - Schedule rules
    - Bell schedules
    - Schedule overrides
    - Subjects
    """
    # 1. Stored Files (Exact binary sizes and MIME breakdown)
    file_stats_stmt = select(
        func.count(StoredFile.id),
        func.coalesce(func.sum(StoredFile.size), 0)
    )
    file_stats_res = await db.execute(file_stats_stmt)
    files_count, files_total_bytes = file_stats_res.one()

    # Detailed breakdown of files by category
    files_stmt = select(StoredFile.filename, StoredFile.content_type, StoredFile.size)
    files_res = await db.execute(files_stmt)
    all_files_meta = files_res.all()

    pdf_bytes = 0
    pdf_count = 0
    presentation_bytes = 0
    presentation_count = 0
    image_bytes = 0
    image_count = 0
    other_file_bytes = 0
    other_file_count = 0

    for fname, ctype, fsize in all_files_meta:
        fname_lower = (fname or "").lower()
        ctype_lower = (ctype or "").lower()
        if fname_lower.endswith(".pdf") or "pdf" in ctype_lower:
            pdf_bytes += fsize
            pdf_count += 1
        elif (
            fname_lower.endswith((".pptx", ".ppt"))
            or "presentation" in ctype_lower
            or "powerpoint" in ctype_lower
        ):
            presentation_bytes += fsize
            presentation_count += 1
        elif ctype_lower.startswith("image/"):
            image_bytes += fsize
            image_count += 1
        else:
            other_file_bytes += fsize
            other_file_count += 1

    # 2. Homework entries (approximate text + metadata + embedded base64 json)
    hw_stmt = select(HomeworkEntry)
    hw_res = await db.execute(hw_stmt)
    all_hw = hw_res.scalars().all()
    hw_count = len(all_hw)
    hw_bytes = 0
    for h in all_hw:
        # Base row overhead (~128 bytes) + text length + json sizes
        hw_bytes += 128 + len((h.text or "").encode("utf-8"))
        if h.images:
            for img in h.images:
                hw_bytes += len(str(img).encode("utf-8"))
        if h.attachments:
            for att in h.attachments:
                hw_bytes += len(str(att).encode("utf-8"))

    # 3. Schedule rules
    rules_count_res = await db.execute(select(func.count(ScheduleRule.id)))
    rules_count = rules_count_res.scalar() or 0
    rules_bytes = rules_count * 128  # ~128 bytes per relational rule row

    # 4. Schedule overrides
    overrides_count_res = await db.execute(select(func.count(ScheduleOverride.id)))
    overrides_count = overrides_count_res.scalar() or 0
    overrides_bytes = overrides_count * 160

    # 5. Bell schedules
    bells_count_res = await db.execute(select(func.count(BellSchedule.id)))
    bells_count = bells_count_res.scalar() or 0
    bells_bytes = bells_count * 96

    # 6. Subjects
    subjects_count_res = await db.execute(select(func.count(Subject.id)))
    subjects_count = subjects_count_res.scalar() or 0
    subjects_bytes = subjects_count * 140

    total_database_bytes = (
        int(files_total_bytes)
        + hw_bytes
        + rules_bytes
        + overrides_bytes
        + bells_bytes
        + subjects_bytes
    )

    return {
        "total_bytes": total_database_bytes,
        "categories": [
            {
                "id": "files",
                "label": "Attached Files (PDF, PPTX, Images)",
                "bytes": int(files_total_bytes),
                "count": files_count,
                "is_file_storage": True,
                "subcategories": {
                    "pdf": {"bytes": pdf_bytes, "count": pdf_count},
                    "presentation": {"bytes": presentation_bytes, "count": presentation_count},
                    "images": {"bytes": image_bytes, "count": image_count},
                    "other": {"bytes": other_file_bytes, "count": other_file_count},
                },
            },
            {
                "id": "homework",
                "label": "Homework Records & Texts",
                "bytes": hw_bytes,
                "count": hw_count,
                "is_file_storage": False,
            },
            {
                "id": "schedule_rules",
                "label": "Timetable Rules",
                "bytes": rules_bytes,
                "count": rules_count,
                "is_file_storage": False,
            },
            {
                "id": "overrides",
                "label": "Weekly Substitutions",
                "bytes": overrides_bytes,
                "count": overrides_count,
                "is_file_storage": False,
            },
            {
                "id": "bells",
                "label": "Bell Timetables",
                "bytes": bells_bytes,
                "count": bells_count,
                "is_file_storage": False,
            },
            {
                "id": "subjects",
                "label": "School Subjects",
                "bytes": subjects_bytes,
                "count": subjects_count,
                "is_file_storage": False,
            },
        ],
    }

