import calendar
from collections import defaultdict
from datetime import date, timedelta, datetime, time
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule_rule import ScheduleRule, WeekType
from app.models.schedule_override import ScheduleOverride
from app.models.homework import HomeworkEntry
from app.schemas.schedule import DaySchedule, LessonSlot, NextLessonResponse
from app.utils.week_type import get_week_type
from app.schemas.subject import SubjectRead
from app.schemas.homework import HomeworkRead

async def get_schedule_for_range(
    db: AsyncSession, 
    start_date: date, 
    end_date: date, 
    anchor_date: date
) -> list[DaySchedule]:
    """
    Retrieve the schedule for a given date range with optimized batch queries
    to eliminate N+1 database roundtrips. Integrates temporal schedule overrides
    for weekly substitute lessons while preserving the original lesson context in brackets.
    """
    # Pre-fetch all homework entries for the requested date range in a single query
    hw_stmt = select(HomeworkEntry).where(
        HomeworkEntry.due_date >= start_date,
        HomeworkEntry.due_date <= end_date,
    )
    hw_result = await db.execute(hw_stmt)
    all_hw = hw_result.scalars().all()

    # Index homework entries by (due_date, subject_id) for instant O(1) lookup
    hw_by_day_and_subject: dict[tuple[date, any], list[HomeworkEntry]] = defaultdict(list)
    for hw in all_hw:
        hw_by_day_and_subject[(hw.due_date, hw.subject_id)].append(hw)

    # Pre-fetch all temporal schedule overrides for the requested date range
    ov_stmt = (
        select(ScheduleOverride)
        .options(
            selectinload(ScheduleOverride.subject),
            selectinload(ScheduleOverride.original_subject),
        )
        .where(
            ScheduleOverride.date >= start_date,
            ScheduleOverride.date <= end_date,
        )
    )
    ov_result = await db.execute(ov_stmt)
    all_overrides = ov_result.scalars().all()
    overrides_by_day_and_order: dict[tuple[date, int], ScheduleOverride] = {
        (ov.date, ov.lesson_order): ov for ov in all_overrides
    }

    # Generate list of dates
    num_days = (end_date - start_date).days + 1
    dates = [start_date + timedelta(days=i) for i in range(num_days)]
    
    schedules = []
    
    for current_date in dates:
        day_of_week = current_date.weekday() + 1 # 1 (Mon) to 7 (Sun)
        current_week_type_str = get_week_type(current_date, anchor_date)
        
        # Query rules for this day with eager-loaded subject relationships
        stmt = (
            select(ScheduleRule)
            .options(selectinload(ScheduleRule.subject))
            .where(
                ScheduleRule.day_of_week == day_of_week,
                ScheduleRule.week_type.in_([current_week_type_str, "all"])
            )
            .order_by(ScheduleRule.lesson_order)
        )
        
        result = await db.execute(stmt)
        rules = result.scalars().all()
        
        # Build lessons using in-memory indexed homework and apply temporal overrides
        lessons = []
        handled_orders = set()

        for rule in rules:
            handled_orders.add(rule.lesson_order)
            override = overrides_by_day_and_order.get((current_date, rule.lesson_order))

            active_subject = rule.subject
            orig_subject_read = None
            is_override = False
            is_cancelled = False
            cabinet = rule.cabinet
            start_time = rule.start_time
            end_time = rule.end_time
            override_note = None

            if override:
                is_override = True
                is_cancelled = override.is_cancelled
                override_note = override.note
                if override.start_time:
                    start_time = override.start_time
                if override.end_time:
                    end_time = override.end_time
                if override.cabinet is not None:
                    cabinet = override.cabinet

                if is_cancelled:
                    orig_subject_read = SubjectRead.model_validate(rule.subject)
                elif override.subject:
                    orig_subject_read = SubjectRead.model_validate(rule.subject)
                    active_subject = override.subject
                elif override.original_subject:
                    orig_subject_read = SubjectRead.model_validate(override.original_subject)

            # Match homework for active subject on this date & lesson order
            matching_hw = [
                hw for hw in hw_by_day_and_subject.get((current_date, active_subject.id), [])
                if hw.lesson_order is None or hw.lesson_order == rule.lesson_order
            ]
            homework_reads = [HomeworkRead.model_validate(hw) for hw in matching_hw]
            
            lesson = LessonSlot(
                date=current_date,
                lesson_order=rule.lesson_order,
                subject=SubjectRead.model_validate(active_subject),
                start_time=start_time,
                end_time=end_time,
                cabinet=cabinet,
                homework=homework_reads,
                original_subject=orig_subject_read,
                is_override=is_override,
                is_cancelled=is_cancelled,
                override_note=override_note,
            )
            lessons.append(lesson)

        # Also incorporate any stand-alone overrides for slots not in regular rules
        for (ov_date, ov_order), override in overrides_by_day_and_order.items():
            if ov_date == current_date and ov_order not in handled_orders:
                if override.subject:
                    matching_hw = [
                        hw for hw in hw_by_day_and_subject.get((current_date, override.subject_id), [])
                        if hw.lesson_order is None or hw.lesson_order == ov_order
                    ]
                    homework_reads = [HomeworkRead.model_validate(hw) for hw in matching_hw]
                    lesson = LessonSlot(
                        date=current_date,
                        lesson_order=ov_order,
                        subject=SubjectRead.model_validate(override.subject),
                        start_time=override.start_time or time(8, 30),
                        end_time=override.end_time or time(9, 15),
                        cabinet=override.cabinet,
                        homework=homework_reads,
                        original_subject=SubjectRead.model_validate(override.original_subject) if override.original_subject else None,
                        is_override=True,
                        is_cancelled=override.is_cancelled,
                        override_note=override.note,
                    )
                    lessons.append(lesson)

        # Keep lessons sorted by lesson order
        lessons.sort(key=lambda l: l.lesson_order)

        day_name = calendar.day_name[current_date.weekday()]
        
        day_schedule = DaySchedule(
            date=current_date,
            day_name=day_name,
            week_type=current_week_type_str,
            lessons=lessons
        )
        schedules.append(day_schedule)
        
    return schedules


async def find_closest_next_lesson(
    db: AsyncSession,
    subject_id: any,
    anchor_date: date,
    current_date: date | None = None,
    current_lesson_order: int | None = None,
    from_date: date | None = None,
    max_days_forward: int = 28,
) -> NextLessonResponse | None:
    """
    Find the NEXT upcoming occurrence of a lesson for a subject.
    Never returns the current lesson slot that was clicked on.
    If viewing a past date, searches from today forward.
    If viewing today or a future date, searches strictly after (current_date, current_lesson_order).
    """
    today = date.today()
    if current_date:
        if current_date >= today:
            search_start = current_date
        else:
            search_start = today
    else:
        search_start = from_date or today

    end_date = search_start + timedelta(days=max_days_forward)
    schedules = await get_schedule_for_range(db, search_start, end_date, anchor_date)

    target_id_str = str(subject_id)
    now_time = datetime.now().time()

    for day in schedules:
        for lesson in day.lessons:
            # Skip cancelled lessons
            if lesson.is_cancelled:
                continue
            if str(lesson.subject.id) != target_id_str:
                continue

            # If this is the exact same day the user clicked from:
            if current_date and day.date == current_date:
                # Must be strictly after current_lesson_order
                if current_lesson_order is not None and lesson.lesson_order <= current_lesson_order:
                    continue

            # If the user clicked from a past date, but this is today:
            # Skip lessons that already ended earlier today
            if current_date and current_date < today and day.date == today:
                if lesson.end_time and lesson.end_time <= now_time:
                    continue

            return NextLessonResponse(
                date=day.date,
                lesson_order=lesson.lesson_order,
                subject_id=lesson.subject.id,
                subject_name=lesson.subject.name,
                start_time=lesson.start_time,
                end_time=lesson.end_time,
                cabinet=lesson.cabinet,
            )

    return None
