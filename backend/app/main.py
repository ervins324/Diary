import logging
import sys
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.database import engine, AsyncSessionLocal
from app.routers import (
    subjects,
    schedule,
    homework,
    stats,
    bells,
    system,
    files,
    lesson_notes,
    holidays,
    settings as settings_router,
)
from app.services.alert_service import check_air_alerts, run_backend_auto_clean

# Configure centralized logging with timestamp, level, and logger name
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("school_diary")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is up-to-date with safety column additions
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE schedule_overrides ADD COLUMN IF NOT EXISTS event_type VARCHAR(50);")
            )
            await conn.execute(
                text("ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0;")
            )
            await conn.execute(
                text("ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS is_failed BOOLEAN DEFAULT FALSE;")
            )
            await conn.execute(
                text("ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS assigned_date DATE;")
            )
            await conn.execute(
                text("ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();")
            )
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS lesson_notes (
                    id UUID PRIMARY KEY,
                    date DATE NOT NULL,
                    lesson_order SMALLINT NOT NULL,
                    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
                    text TEXT NOT NULL,
                    images JSON DEFAULT '[]',
                    attachments JSON DEFAULT '[]',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                """)
            )
            await conn.execute(
                text("ALTER TABLE lesson_notes ADD COLUMN IF NOT EXISTS images JSON DEFAULT '[]';")
            )
            await conn.execute(
                text("ALTER TABLE lesson_notes ADD COLUMN IF NOT EXISTS attachments JSON DEFAULT '[]';")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_lesson_notes_date_order ON lesson_notes (date, lesson_order);")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_lesson_notes_date ON lesson_notes (date);")
            )
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS holidays (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(200) NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL
                );
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_holidays_start_date ON holidays (start_date);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_holidays_end_date ON holidays (end_date);"))
            await conn.execute(
                text("ALTER TABLE schedule_rules ADD COLUMN IF NOT EXISTS is_consultation BOOLEAN DEFAULT FALSE;")
            )
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS app_settings (
                    id VARCHAR(50) PRIMARY KEY,
                    skip_weekends_to_monday BOOLEAN DEFAULT TRUE,
                    day_shift_after_hour INTEGER,
                    show_cabinets BOOLEAN DEFAULT TRUE,
                    live_widget_enabled BOOLEAN DEFAULT TRUE,
                    live_widget_show_lesson BOOLEAN DEFAULT TRUE,
                    live_widget_show_homework BOOLEAN DEFAULT TRUE,
                    live_widget_show_events BOOLEAN DEFAULT TRUE,
                    hw_icon_size VARCHAR(20) DEFAULT 'medium',
                    air_alerts_enabled BOOLEAN DEFAULT FALSE,
                    air_alerts_region VARCHAR(100) DEFAULT 'kyiv_city',
                    air_alerts_auto_cancel BOOLEAN DEFAULT FALSE,
                    default_lesson_duration INTEGER DEFAULT 45,
                    default_break_duration INTEGER DEFAULT 10,
                    auto_bell_notifications BOOLEAN DEFAULT FALSE,
                    semester_anchor_date VARCHAR(20) DEFAULT '2026-09-01',
                    font_family VARCHAR(50) DEFAULT 'inter',
                    theme VARCHAR(20) DEFAULT 'dark',
                    language VARCHAR(10) DEFAULT 'uk',
                    custom_event_types JSON DEFAULT '[]',
                    custom_lesson_types JSON DEFAULT '[]',
                    auto_clean_settings JSON DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """))
            logger.info("Database safety column verification completed.")
    except Exception as e:
        logger.warning(f"Database safety migration check warning: {e}")

    # Launch background automation task (air alerts and daily auto-clean)
    async def background_automation_worker():
        logger.info("Starting background automation worker (air alerts & auto-clean)...")
        while True:
            try:
                await asyncio.sleep(30)
                async with AsyncSessionLocal() as db:
                    await check_air_alerts(db)
                    await run_backend_auto_clean(db)
            except asyncio.CancelledError:
                logger.info("Background automation worker received cancellation signal.")
                break
            except Exception as loop_err:
                logger.warning(f"Background automation loop error: {loop_err}")

    automation_task = asyncio.create_task(background_automation_worker())
    try:
        yield
    finally:
        automation_task.cancel()
        try:
            await automation_task
        except asyncio.CancelledError:
            pass

app = FastAPI(title="School Diary API", version="1.0.0", lifespan=lifespan)

# Global exception handler to log full tracebacks for any unhandled 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error processing {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )

# Request logging middleware for full request lifecycle visibility
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    if response.status_code >= 400:
        logger.warning(f"Completed request: {request.method} {request.url.path} -> {response.status_code}")
    else:
        logger.info(f"Completed request: {request.method} {request.url.path} -> {response.status_code}")
    return response

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(subjects.router)
app.include_router(schedule.router)
app.include_router(homework.router)
app.include_router(stats.router)
app.include_router(bells.router)
app.include_router(system.router)
app.include_router(files.router)
app.include_router(lesson_notes.router)
app.include_router(holidays.router)
app.include_router(settings_router.router)

@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {"status": "ok", "version": "1.0.0"}
