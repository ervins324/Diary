from datetime import date, timedelta, datetime
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule_rule import ScheduleRule
from app.models.schedule_override import ScheduleOverride
from app.models.homework import HomeworkEntry
from app.utils.week_type import get_week_type
from collections import defaultdict

async def get_weekly_stats(
    db: AsyncSession,
    target_date: date,
    anchor_date: date,
    mode: str = "actual"  # "actual" | "numerator" | "denominator"
) -> dict:
    """
    Get comprehensive statistics for the week containing the target date:
    - Subject minutes breakdown for the chart
    - Total unique subjects taught this week
    - Total lessons scheduled (accounting for cancellations in 'actual' mode)
    - Cancelled lessons count (deducted from total and subject counts)
    - Average lessons per active school day
    - Total break time between lessons (minutes)
    - Homework completion analytics (total, completed, completion_rate)
    - Academic events count (control_work, test, essay, project)
    - Subject lessons_count alongside total_minutes
    - Mode support: 'actual' (live week with overrides), 'numerator' (template), 'denominator' (template)
    """
    # Find Monday and Sunday of the week
    weekday = target_date.weekday()
    monday = target_date - timedelta(days=weekday)
    sunday = monday + timedelta(days=6)

    # Pre-fetch weekly homework entries
    hw_stmt = select(HomeworkEntry).where(
        HomeworkEntry.due_date >= monday,
        HomeworkEntry.due_date <= sunday,
    )
    hw_result = await db.execute(hw_stmt)
    hw_entries = hw_result.scalars().all()
    hw_total = len(hw_entries)
    hw_completed = sum(1 for h in hw_entries if h.is_completed)
    hw_completion_rate = round((hw_completed / hw_total) * 100, 1) if hw_total > 0 else 100.0
    hw_total_time_spent = sum(getattr(h, "time_spent_seconds", 0) or 0 for h in hw_entries)
    hw_avg_time_spent = round(hw_total_time_spent / hw_total) if hw_total > 0 else 0

    # In 'actual' mode, pre-fetch overrides for the week
    overrides_by_date_order = {}
    event_counts = {
        "control_work": 0,
        "test": 0,
        "essay": 0,
        "project": 0,
    }
    cancelled_lessons_count = 0

    if mode == "actual":
        ov_stmt = (
            select(ScheduleOverride)
            .options(
                selectinload(ScheduleOverride.subject),
                selectinload(ScheduleOverride.original_subject),
            )
            .where(
                ScheduleOverride.date >= monday,
                ScheduleOverride.date <= sunday,
            )
        )
        ov_res = await db.execute(ov_stmt)
        overrides = ov_res.scalars().all()
        for ov in overrides:
            overrides_by_date_order[(ov.date, ov.lesson_order)] = ov
            if ov.is_cancelled:
                cancelled_lessons_count += 1
            if ov.event_type and ov.event_type in event_counts:
                event_counts[ov.event_type] += 1
    
    stats_map = defaultdict(lambda: {
        "total_minutes": 0,
        "lessons_count": 0,
        "subject_name": "",
        "short_name": "",
        "color_hex": ""
    })
    
    total_lessons = 0
    total_break_minutes = 0.0
    active_days_count = 0
    days_list = []
    day_keys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    for i in range(7):
        current_date = monday + timedelta(days=i)
        day_of_week = current_date.weekday() + 1
        
        # Determine week type based on mode
        if mode == "numerator":
            week_type_str = "numerator"
        elif mode == "denominator":
            week_type_str = "denominator"
        else:
            week_type_str = get_week_type(current_date, anchor_date)
        
        stmt = (
            select(ScheduleRule)
            .options(selectinload(ScheduleRule.subject))
            .where(
                ScheduleRule.day_of_week == day_of_week,
                ScheduleRule.week_type.in_([week_type_str, "all"])
            )
            .order_by(ScheduleRule.lesson_order, ScheduleRule.start_time)
        )
        
        result = await db.execute(stmt)
        rules = result.scalars().all()

        day_study_minutes = 0.0
        day_break_minutes = 0.0
        day_subjects = []
        active_day_lessons = []

        # Process each scheduled rule and apply overrides if in actual mode
        for rule in rules:
            override = overrides_by_date_order.get((current_date, rule.lesson_order)) if mode == "actual" else None
            
            # If lesson is cancelled in actual mode, do not count it in active lesson minutes/counts
            if override and override.is_cancelled:
                day_subjects.append({
                    "name": (override.subject or rule.subject).name,
                    "short_name": (override.subject or rule.subject).short_name,
                    "color_hex": (override.subject or rule.subject).color_hex,
                    "cabinet": override.cabinet or rule.cabinet,
                    "lesson_order": rule.lesson_order,
                    "start_time": rule.start_time.strftime("%H:%M") if hasattr(rule.start_time, "strftime") else str(rule.start_time)[:5],
                    "end_time": rule.end_time.strftime("%H:%M") if hasattr(rule.end_time, "strftime") else str(rule.end_time)[:5],
                    "is_cancelled": True,
                    "note": override.note,
                    "event_type": override.event_type,
                })
                continue

            # Effective subject
            effective_subject = (override.subject if override and override.subject else rule.subject)
            start_t = (override.start_time if override and override.start_time else rule.start_time)
            end_t = (override.end_time if override and override.end_time else rule.end_time)
            cabinet = (override.cabinet if override and override.cabinet is not None else rule.cabinet)

            # Calculate duration in minutes
            dt_start = datetime.combine(date.today(), start_t)
            dt_end = datetime.combine(date.today(), end_t)
            duration_minutes = (dt_end - dt_start).total_seconds() / 60
            day_study_minutes += duration_minutes

            active_day_lessons.append((start_t, end_t))

            day_subjects.append({
                "name": effective_subject.name,
                "short_name": effective_subject.short_name,
                "color_hex": effective_subject.color_hex,
                "cabinet": cabinet,
                "lesson_order": rule.lesson_order,
                "start_time": start_t.strftime("%H:%M") if hasattr(start_t, "strftime") else str(start_t)[:5],
                "end_time": end_t.strftime("%H:%M") if hasattr(end_t, "strftime") else str(end_t)[:5],
                "is_cancelled": False,
                "note": override.note if override else None,
                "event_type": override.event_type if override else None,
            })
            
            sid = str(effective_subject.id)
            stats_map[sid]["subject_name"] = effective_subject.name
            stats_map[sid]["short_name"] = effective_subject.short_name
            stats_map[sid]["color_hex"] = effective_subject.color_hex
            stats_map[sid]["total_minutes"] += duration_minutes
            stats_map[sid]["lessons_count"] += 1

        if active_day_lessons:
            active_days_count += 1
            total_lessons += len(active_day_lessons)

            # Calculate break times between consecutive non-cancelled lessons on the same day
            for idx in range(len(active_day_lessons) - 1):
                cur_end = datetime.combine(date.today(), active_day_lessons[idx][1])
                next_start = datetime.combine(date.today(), active_day_lessons[idx + 1][0])
                break_duration = (next_start - cur_end).total_seconds() / 60
                if break_duration > 0:
                    day_break_minutes += break_duration
                    total_break_minutes += break_duration

        # Homework due on this specific day
        hw_day = [h for h in hw_entries if h.due_date == current_date]
        hw_day_completed = sum(1 for h in hw_day if h.is_completed)
        hw_day_time_spent = sum(getattr(h, "time_spent_seconds", 0) or 0 for h in hw_day)

        days_list.append({
            "day_of_week": day_of_week,
            "date": current_date.isoformat(),
            "day_key": day_keys[i],
            "lessons_count": len(active_day_lessons),
            "total_minutes": int(day_study_minutes),
            "break_minutes": int(day_break_minutes),
            "subjects": day_subjects,
            "homework_count": len(hw_day),
            "homework_completed": hw_day_completed,
            "homework_time_spent_seconds": hw_day_time_spent,
        })
            
    # Calculate average lessons per active day
    avg_lessons = round(total_lessons / active_days_count, 1) if active_days_count > 0 else 0.0

    # Sort subjects alphabetically so bar chart order remains consistent across numerator and denominator weeks
    sorted_subjects = sorted(stats_map.values(), key=lambda s: s["subject_name"].lower())

    return {
        "subjects": sorted_subjects,
        "days": days_list,
        "total_subjects": len(stats_map),
        "total_lessons": total_lessons,
        "cancelled_lessons_count": cancelled_lessons_count,
        "avg_lessons_per_day": avg_lessons,
        "total_break_minutes": int(total_break_minutes),
        "mode": mode,
        "event_counts": event_counts,
        "homework_stats": {
            "total": hw_total,
            "completed": hw_completed,
            "completion_rate": hw_completion_rate,
            "total_time_spent_seconds": hw_total_time_spent,
            "avg_time_spent_seconds": hw_avg_time_spent,
        },
    }
