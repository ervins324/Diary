from datetime import date, timedelta, datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule_rule import ScheduleRule
from app.utils.week_type import get_week_type
from collections import defaultdict

async def get_weekly_stats(db: AsyncSession, target_date: date, anchor_date: date) -> list[dict]:
    """
    Get statistics for the week containing the target date.
    Returns total minutes per subject.
    """
    # Find Monday and Sunday of the week
    weekday = target_date.weekday()
    monday = target_date - timedelta(days=weekday)
    
    stats_map = defaultdict(lambda: {"total_minutes": 0, "subject_name": "", "short_name": "", "color_hex": ""})
    
    for i in range(7):
        current_date = monday + timedelta(days=i)
        day_of_week = current_date.weekday() + 1
        week_type_str = get_week_type(current_date, anchor_date)
        
        stmt = select(ScheduleRule).where(
            ScheduleRule.day_of_week == day_of_week,
            ScheduleRule.week_type.in_([week_type_str, "all"])
        )
        
        result = await db.execute(stmt)
        rules = result.scalars().all()
        
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
            
    # Convert map to list
    return list(stats_map.values())
