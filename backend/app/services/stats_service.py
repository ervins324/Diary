from datetime import date, timedelta, datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule_rule import ScheduleRule
from app.models.homework import HomeworkEntry
from app.utils.week_type import get_week_type
from collections import defaultdict

async def get_weekly_stats(db: AsyncSession, target_date: date, anchor_date: date) -> dict:
    """
    Get comprehensive statistics for the week containing the target date:
    - Subject minutes breakdown for the chart
    - Total unique subjects taught this week
    - Total lessons scheduled
    - Average lessons per active school day
    - Total break time between lessons (minutes)
    - Homework completion analytics (total, completed, completion_rate)
    """
    # Find Monday and Sunday of the week
    weekday = target_date.weekday()
    monday = target_date - timedelta(days=weekday)
    sunday = monday + timedelta(days=6)
    
    stats_map = defaultdict(lambda: {"total_minutes": 0, "subject_name": "", "short_name": "", "color_hex": ""})
    
    total_lessons = 0
    total_break_minutes = 0.0
    active_days_count = 0

    for i in range(7):
        current_date = monday + timedelta(days=i)
        day_of_week = current_date.weekday() + 1
        week_type_str = get_week_type(current_date, anchor_date)
        
        stmt = select(ScheduleRule).where(
            ScheduleRule.day_of_week == day_of_week,
            ScheduleRule.week_type.in_([week_type_str, "all"])
        ).order_by(ScheduleRule.lesson_order, ScheduleRule.start_time)
        
        result = await db.execute(stmt)
        rules = result.scalars().all()
        
        if rules:
            active_days_count += 1
            total_lessons += len(rules)

            # Calculate break times between consecutive lessons on the same day
            for idx in range(len(rules) - 1):
                cur_end = datetime.combine(date.today(), rules[idx].end_time)
                next_start = datetime.combine(date.today(), rules[idx + 1].start_time)
                break_duration = (next_start - cur_end).total_seconds() / 60
                if break_duration > 0:
                    total_break_minutes += break_duration

        for rule in rules:
            subject = rule.subject
            # Calculate duration in minutes
            dt_start = datetime.combine(date.today(), rule.start_time)
            dt_end = datetime.combine(date.today(), rule.end_time)
            duration_minutes = (dt_end - dt_start).total_seconds() / 60
            
            sid = str(subject.id)
            stats_map[sid]["subject_name"] = subject.name
            stats_map[sid]["short_name"] = subject.short_name
            stats_map[sid]["color_hex"] = subject.color_hex
            stats_map[sid]["total_minutes"] += duration_minutes
            
    # Calculate average lessons per active day
    avg_lessons = round(total_lessons / active_days_count, 1) if active_days_count > 0 else 0.0

    # Calculate weekly homework statistics
    hw_stmt = select(HomeworkEntry).where(
        HomeworkEntry.due_date >= monday,
        HomeworkEntry.due_date <= sunday,
    )
    hw_result = await db.execute(hw_stmt)
    hw_entries = hw_result.scalars().all()
    hw_total = len(hw_entries)
    hw_completed = sum(1 for h in hw_entries if h.is_completed)
    hw_completion_rate = round((hw_completed / hw_total) * 100, 1) if hw_total > 0 else 100.0

    # Sort subjects alphabetically so bar chart order remains consistent across numerator and denominator weeks
    sorted_subjects = sorted(stats_map.values(), key=lambda s: s["subject_name"].lower())

    return {
        "subjects": sorted_subjects,
        "total_subjects": len(stats_map),
        "total_lessons": total_lessons,
        "avg_lessons_per_day": avg_lessons,
        "total_break_minutes": int(total_break_minutes),
        "homework_stats": {
            "total": hw_total,
            "completed": hw_completed,
            "completion_rate": hw_completion_rate,
        },
    }
