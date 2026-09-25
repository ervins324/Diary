import logging
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.setting import AppSettings
from app.schemas.setting import (
    AppSettingsRead,
    AppSettingsUpdate,
    EffectiveDateResponse,
)
from app.services.alert_service import check_air_alerts, run_backend_auto_clean

logger = logging.getLogger("school_diary.settings")

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


async def get_or_create_settings(db: AsyncSession) -> AppSettings:
    """Helper to fetch singleton settings row or initialize it with defaults."""
    stmt = select(AppSettings).where(AppSettings.id == "default")
    result = await db.execute(stmt)
    settings_obj = result.scalar_one_or_none()

    if not settings_obj:
        settings_obj = AppSettings(id="default")
        db.add(settings_obj)
        await db.commit()
        await db.refresh(settings_obj)

    return settings_obj


@router.get("", response_model=AppSettingsRead)
@router.get("/", response_model=AppSettingsRead, include_in_schema=False)
async def get_settings(db: AsyncSession = Depends(get_db)):
    """
    Get application settings stored in PostgreSQL.
    Initializes default settings if none exist.
    """
    return await get_or_create_settings(db)


@router.patch("", response_model=AppSettingsRead)
@router.patch("/", response_model=AppSettingsRead, include_in_schema=False)
@router.put("", response_model=AppSettingsRead, include_in_schema=False)
@router.put("/", response_model=AppSettingsRead, include_in_schema=False)
async def update_settings(
    settings_in: AppSettingsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update application settings with partial fields.
    Persists changes centrally so they synchronize across all devices.
    """
    settings_obj = await get_or_create_settings(db)

    update_data = settings_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(settings_obj, field, value)

    await db.commit()
    await db.refresh(settings_obj)
    logger.info(f"Updated app settings: {list(update_data.keys())}")
    return settings_obj


@router.post("/reset", response_model=AppSettingsRead)
async def reset_settings(db: AsyncSession = Depends(get_db)):
    """
    Reset application settings to default state.
    """
    settings_obj = await get_or_create_settings(db)
    
    settings_obj.skip_weekends_to_monday = True
    settings_obj.day_shift_after_hour = None
    settings_obj.show_cabinets = True
    settings_obj.live_widget_enabled = True
    settings_obj.live_widget_show_lesson = True
    settings_obj.live_widget_show_homework = True
    settings_obj.live_widget_show_events = True
    settings_obj.hw_icon_size = "medium"

    settings_obj.air_alerts_enabled = False
    settings_obj.air_alerts_region = "kyiv_city"
    settings_obj.air_alerts_auto_cancel = False

    settings_obj.default_lesson_duration = 45
    settings_obj.default_break_duration = 10
    settings_obj.auto_bell_notifications = False
    settings_obj.semester_anchor_date = "2026-09-01"

    settings_obj.font_family = "inter"
    settings_obj.theme = "dark"
    settings_obj.language = "uk"

    settings_obj.custom_event_types = []
    settings_obj.custom_lesson_types = []
    settings_obj.auto_clean_settings = {}

    await db.commit()
    await db.refresh(settings_obj)
    return settings_obj


@router.get("/effective-date", response_model=EffectiveDateResponse)
async def get_effective_date(db: AsyncSession = Depends(get_db)):
    """
    Calculates the current effective school date on the server, taking into account
    'skip_weekends_to_monday' and 'day_shift_after_hour' preferences stored in backend.
    """
    settings_obj = await get_or_create_settings(db)
    now = datetime.now()
    cur_date = now.date()

    is_shifted = False
    is_weekend_skipped = False
    reason_parts = []

    # 1. Check afternoon cutoff hour
    if settings_obj.day_shift_after_hour is not None and now.hour >= settings_obj.day_shift_after_hour:
        cur_date += timedelta(days=1)
        is_shifted = True
        reason_parts.append(f"Shifted after cutoff hour {settings_obj.day_shift_after_hour}:00")

    # 2. Check weekend skipping
    if settings_obj.skip_weekends_to_monday:
        weekday = cur_date.weekday()
        if weekday == 5:  # Saturday
            cur_date += timedelta(days=2)
            is_weekend_skipped = True
            reason_parts.append("Skipped Saturday to Monday")
        elif weekday == 6:  # Sunday
            cur_date += timedelta(days=1)
            is_weekend_skipped = True
            reason_parts.append("Skipped Sunday to Monday")

    return EffectiveDateResponse(
        date=cur_date.isoformat(),
        is_shifted=is_shifted,
        is_weekend_skipped=is_weekend_skipped,
        reason=", ".join(reason_parts) if reason_parts else None,
    )


@router.post("/check-alerts")
async def trigger_air_alerts_check(db: AsyncSession = Depends(get_db)):
    """
    Manually triggers server-side air alert check and auto-cancellation.
    """
    return await check_air_alerts(db)


@router.post("/run-auto-clean")
async def trigger_auto_clean(db: AsyncSession = Depends(get_db)):
    """
    Manually triggers server-side historical data cleanup.
    """
    return await run_backend_auto_clean(db)
