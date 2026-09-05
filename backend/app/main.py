from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import subjects, schedule, homework, stats

app = FastAPI(title="School Diary API", version="1.0.0")

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
