import logging
import sys
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import subjects, schedule, homework, stats

# Configure centralized logging with timestamp, level, and logger name
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("school_diary")

app = FastAPI(title="School Diary API", version="1.0.0")

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

@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {"status": "ok", "version": "1.0.0"}
