import calendar
from collections import defaultdict
from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule_rule import ScheduleRule, WeekType
from app.models.homework import HomeworkEntry
from app.schemas.schedule import DaySchedule, LessonSlot
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
    to eliminate N+1 database roundtrips.
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
        
        # Build lessons using in-memory indexed homework
        lessons = []
        for rule in rules:
            matching_hw = [
                hw for hw in hw_by_day_and_subject.get((current_date, rule.subject_id), [])
                if hw.lesson_order is None or hw.lesson_order == rule.lesson_order
            ]
            homework_reads = [HomeworkRead.model_validate(hw) for hw in matching_hw]
            
            lesson = LessonSlot(
                date=current_date,
                lesson_order=rule.lesson_order,
                subject=SubjectRead.model_validate(rule.subject),
                start_time=rule.start_time,
                end_time=rule.end_time,
                cabinet=rule.cabinet,
                homework=homework_reads
            )
            lessons.append(lesson)
            
        day_name = calendar.day_name[current_date.weekday()]
        
        day_schedule = DaySchedule(
            date=current_date,
            day_name=day_name,
            week_type=current_week_type_str,
            lessons=lessons
        )
        schedules.append(day_schedule)
        
    return schedules
