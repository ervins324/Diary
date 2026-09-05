from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.services.stats_service import get_weekly_stats

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])

@router.get("/weekly", response_model=list[dict])
async def get_weekly_statistics(
    target_date: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db)
):
    """Get weekly statistics for time spent per subject."""
    anchor_date = date.fromisoformat(settings.SEMESTER_ANCHOR_DATE)
    return await get_weekly_stats(db, target_date, anchor_date)
