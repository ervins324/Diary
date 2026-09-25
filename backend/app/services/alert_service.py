import logging
from datetime import datetime, date, time, timedelta
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.models.setting import AppSettings
from app.models.bell_schedule import BellSchedule
from app.models.schedule_rule import ScheduleRule
from app.models.schedule_override import ScheduleOverride
from app.models.homework import HomeworkEntry
from app.models.stored_file import StoredFile
from app.utils.week_type import get_week_type
from app.schemas.schedule import get_default_bell_times

logger = logging.getLogger("school_diary.alert_service")

NEPTUN_ALERTS_API = "https://neptun.in.ua/api/v1/alerts"

REGION_STEMS: dict[str, list[str]] = {
    "kyiv_city": ["м. київ", "м.київ"],
    "kyiv": ["київськ", "київщин"],
    "vinnytsia": ["вінницьк"],
    "volyn": ["волинськ"],
    "dnipro": ["дніпро", "дніпропетровськ"],
    "donetsk": ["донецьк"],
    "zhytomyr": ["житомир"],
    "zakarpattia": ["закарпат"],
    "zaporizhzhia": ["запорізьк"],
    "ivano_frankivsk": ["івано-франківськ", "прикарпатт"],
    "kirovohrad": ["кіровоград"],
    "luhansk": ["луганськ"],
    "lviv": ["львів"],
    "mykolaiv": ["миколаїв"],
    "odesa": ["одес"],
    "poltava": ["полтав"],
    "rivne": ["рівнен"],
    "sumy": ["сумськ", "м. суми"],
    "ternopil": ["тернопіль"],
    "kharkiv": ["харків"],
    "kherson": ["херсон"],
    "khmelnytskyi": ["хмельницьк"],
    "cherkasy": ["черкас"],
    "chernivtsi": ["чернівецьк", "буковин"],
    "chernihiv": ["чернігів"],
    "crimea": ["крим", "севастополь"],
}

UKRAINIAN_REGIONS_NAME_UK: dict[str, str] = {
    "kyiv_city": "м. Київ",
    "kyiv": "Київська область",
    "vinnytsia": "Вінницька область",
    "volyn": "Волинська область",
    "dnipro": "Дніпропетровська область",
    "donetsk": "Донецька область",
    "zhytomyr": "Житомирська область",
    "zakarpattia": "Закарпатська область",
    "zaporizhzhia": "Запорізька область",
    "ivano_frankivsk": "Івано-Франківська область",
    "kirovohrad": "Кіровоградська область",
    "luhansk": "Луганська область",
    "lviv": "Львівська область",
    "mykolaiv": "Миколаївська область",
    "odesa": "Одеська область",
    "poltava": "Полтавська область",
    "rivne": "Рівненська область",
    "sumy": "Сумська область",
    "ternopil": "Тернопільська область",
    "kharkiv": "Харківська область",
    "kherson": "Херсонська область",
    "khmelnytskyi": "Хмельницька область",
    "cherkasy": "Черкаська область",
    "chernivtsi": "Чернівецька область",
    "chernihiv": "Чернігівська область",
    "crimea": "АР Крим",
}


def is_region_alarmed(raw_data: dict, region_id: str) -> bool:
    """
    Evaluates whether the specified Ukrainian region is currently under an active air alert
    using canonical stems and name matching.
    """
    if not region_id or not raw_data:
        return False
    stems = REGION_STEMS.get(region_id, [])
    is_kyiv_city = region_id == "kyiv_city"

    oblasts = raw_data.get("oblasts", [])
    raions = raw_data.get("raions", [])
    alert_items = (oblasts if isinstance(oblasts, list) else []) + (raions if isinstance(raions, list) else [])

    for item in alert_items:
        if isinstance(item, dict):
            name = item.get("name") or item.get("key") or ""
        elif isinstance(item, str):
            name = item
        else:
            continue

        clean = name.strip().lower()
        if len(clean) < 3:
            continue
        if is_kyiv_city and ("київськ" in clean or "київщин" in clean):
            continue
        if stems and any(stem in clean for stem in stems):
            return True
        fallback = UKRAINIAN_REGIONS_NAME_UK.get(region_id, "").strip().lower()
        if len(fallback) >= 3 and (clean in fallback or fallback in clean):
            return True

    return False


async def check_air_alerts(db: AsyncSession, settings: AppSettings | None = None) -> dict:
    """
    Checks Neptun API for active air alerts in the configured region.
    If alert is active and auto_cancel is enabled in AppSettings, automatically
    creates/updates a ScheduleOverride cancelling the currently ongoing lesson.
    """
    if settings is None:
        stmt = select(AppSettings).where(AppSettings.id == "default")
        result = await db.execute(stmt)
        settings = result.scalar_one_or_none()

    if not settings or not settings.air_alerts_enabled:
        return {"enabled": False, "alarm": False}

    alarm_active = False
    raw_data = {}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(NEPTUN_ALERTS_API)
            if resp.status_code == 200:
                raw_data = resp.json()
                alarm_active = is_region_alarmed(raw_data, settings.air_alerts_region)
            else:
                logger.warning(f"Neptun API returned status {resp.status_code}")
    except Exception as e:
        logger.warning(f"Failed to fetch Neptun air alerts from server: {e}")
        return {"enabled": True, "alarm": False, "error": str(e)}

    cancelled_lessons = []
    if alarm_active and settings.air_alerts_auto_cancel:
        today = date.today()
        now_time = datetime.now().time()

        # Query bells
        bells_res = await db.execute(select(BellSchedule).order_by(BellSchedule.lesson_order))
        bells = bells_res.scalars().all()

        active_orders = []
        if bells:
            for bell in bells:
                if bell.start_time <= now_time <= bell.end_time:
                    active_orders.append(bell.lesson_order)
        else:
            for order in range(1, 11):
                st_str, et_str = get_default_bell_times(order)
                st = datetime.strptime(st_str, "%H:%M").time()
                et = datetime.strptime(et_str, "%H:%M").time()
                if st <= now_time <= et:
                    active_orders.append(order)

        if active_orders:
            anchor = date.fromisoformat(settings.semester_anchor_date) if settings.semester_anchor_date else date(2026, 9, 1)
            current_week_type = get_week_type(today, anchor)
            day_of_week = today.isoweekday()

            for order in active_orders:
                rule_res = await db.execute(
                    select(ScheduleRule).where(
                        ScheduleRule.day_of_week == day_of_week,
                        ScheduleRule.lesson_order == order,
                        ScheduleRule.week_type.in_(["all", current_week_type]),
                    )
                )
                rule = rule_res.scalar_one_or_none()

                override_res = await db.execute(
                    select(ScheduleOverride).where(
                        ScheduleOverride.date == today,
                        ScheduleOverride.lesson_order == order,
                    )
                )
                override = override_res.scalar_one_or_none()

                if rule or override:
                    if override:
                        if not override.is_cancelled:
                            override.is_cancelled = True
                            if not override.note:
                                override.note = "Автоматично скасовано через повітряну тривогу"
                            cancelled_lessons.append(order)
                    else:
                        new_override = ScheduleOverride(
                            date=today,
                            lesson_order=order,
                            is_cancelled=True,
                            original_subject_id=rule.subject_id if rule else None,
                            note="Автоматично скасовано через повітряну тривогу",
                        )
                        db.add(new_override)
                        cancelled_lessons.append(order)

            if cancelled_lessons:
                await db.commit()
                logger.info(
                    f"Auto-cancelled lessons {cancelled_lessons} on {today} due to active air alarm in {settings.air_alerts_region}"
                )

    return {
        "enabled": True,
        "region": settings.air_alerts_region,
        "alarm": alarm_active,
        "auto_cancel": settings.air_alerts_auto_cancel,
        "cancelled_lessons": cancelled_lessons,
    }


async def run_backend_auto_clean(db: AsyncSession, settings: AppSettings | None = None) -> dict:
    """
    Executes automated database pruning based on AppSettings.auto_clean_settings.
    Runs in the background even when browser tabs are closed.
    """
    if settings is None:
        stmt = select(AppSettings).where(AppSettings.id == "default")
        result = await db.execute(stmt)
        settings = result.scalar_one_or_none()

    if not settings:
        return {"status": "no_settings"}

    config = settings.auto_clean_settings or {}
    if not config.get("enabled"):
        return {"status": "disabled"}

    today_str = str(date.today())
    if config.get("last_run_date") == today_str:
        return {"status": "already_run_today"}

    retention = config.get("retention", "3_months")
    now_date = date.today()
    if retention == "2_weeks":
        cutoff = now_date - timedelta(days=14)
    elif retention == "1_month":
        cutoff = now_date - timedelta(days=30)
    elif retention == "3_months":
        cutoff = now_date - timedelta(days=90)
    elif retention == "6_months":
        cutoff = now_date - timedelta(days=180)
    elif retention == "1_year":
        cutoff = now_date - timedelta(days=365)
    else:
        cutoff = now_date - timedelta(days=90)

    deleted_hw = 0
    deleted_ovr = 0
    deleted_files = 0

    try:
        if config.get("clean_homework", True):
            hw_stmt = delete(HomeworkEntry).where(HomeworkEntry.due_date < cutoff)
            if config.get("clean_completed_homework_only"):
                hw_stmt = hw_stmt.where(HomeworkEntry.is_completed == True)
            hw_res = await db.execute(hw_stmt)
            deleted_hw = hw_res.rowcount or 0

        if config.get("clean_schedule_overrides", True):
            ovr_stmt = delete(ScheduleOverride).where(ScheduleOverride.date < cutoff)
            ovr_res = await db.execute(ovr_stmt)
            deleted_ovr = ovr_res.rowcount or 0

        if config.get("clean_orphaned_files", True):
            subq = select(func.json_array_elements(HomeworkEntry.attachments).op("->>")("file_id"))
            del_files_stmt = delete(StoredFile).where(StoredFile.id.not_in(subq))
            files_res = await db.execute(del_files_stmt)
            deleted_files = files_res.rowcount or 0

        config["last_run_date"] = today_str
        settings.auto_clean_settings = dict(config)
        await db.commit()
        logger.info(
            f"Background auto-clean pruned {deleted_hw} homeworks, {deleted_ovr} overrides, {deleted_files} files (cutoff: {cutoff})"
        )
    except Exception as e:
        logger.error(f"Background auto-clean error: {e}")
        await db.rollback()
        return {"status": "error", "message": str(e)}

    return {
        "status": "success",
        "cutoff": str(cutoff),
        "deleted": {
            "homework": deleted_hw,
            "schedule_overrides": deleted_ovr,
            "stored_files": deleted_files,
        },
    }
