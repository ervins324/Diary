import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.holiday import Holiday
from app.schemas.holiday import (
    HolidayRead,
    HolidayCreate,
    HolidayUpdate,
    HolidayBulkCommitRequest,
    AiParseHolidaysResponse,
    JsonHolidaysParseRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/holidays", tags=["holidays"])

@router.get("", response_model=list[HolidayRead])
@router.get("/", response_model=list[HolidayRead], include_in_schema=False)
async def get_holidays(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Holiday).order_by(Holiday.start_date))
    return result.scalars().all()

@router.post("", response_model=HolidayRead, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=HolidayRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_holiday(holiday: HolidayCreate, db: AsyncSession = Depends(get_db)):
    db_holiday = Holiday(**holiday.model_dump())
    db.add(db_holiday)
    await db.commit()
    await db.refresh(db_holiday)
    return db_holiday

@router.post("/bulk", response_model=list[HolidayRead])
async def bulk_commit_holidays(request: HolidayBulkCommitRequest, db: AsyncSession = Depends(get_db)):
    """Bulk commit holidays list (replaces existing holidays)."""
    await db.execute(delete(Holiday))
    created = []
    for h in request.holidays:
        db_holiday = Holiday(**h.model_dump())
        db.add(db_holiday)
        created.append(db_holiday)
    await db.commit()
    result = await db.execute(select(Holiday).order_by(Holiday.start_date))
    return result.scalars().all()

@router.post("/parse-json", response_model=AiParseHolidaysResponse)
async def parse_holidays_json(request: JsonHolidaysParseRequest):
    """
    Parse a JSON string representing holiday intervals.
    Validates structure and returns for client review.
    """
    raw_text = request.raw_json.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Empty JSON payload received")

    # Strip markdown code fences if wrapped in ```json ... ``` or ``` ... ```
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    elif raw_text.startswith("```"):
        raw_text = raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]
    raw_text = raw_text.strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to decode holidays JSON: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

    if isinstance(data, list):
        data = {"holidays": data}

    if not isinstance(data, dict) or "holidays" not in data:
        raise HTTPException(status_code=422, detail="JSON structure must contain a 'holidays' array.")

    try:
        validated = AiParseHolidaysResponse.model_validate(data)
    except Exception as e:
        logger.warning(f"Validation failed for user-submitted holidays JSON: {e}")
        raise HTTPException(status_code=422, detail=f"Holidays JSON validation error: {str(e)}")

    validated.holidays.sort(key=lambda h: h.start_date)
    return validated

@router.put("/{holiday_id}", response_model=HolidayRead)
async def update_holiday(holiday_id: uuid.UUID, holiday_update: HolidayUpdate, db: AsyncSession = Depends(get_db)):
    db_holiday = await db.get(Holiday, holiday_id)
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    update_data = holiday_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_holiday, key, value)
        
    await db.commit()
    await db.refresh(db_holiday)
    return db_holiday

@router.delete("/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holiday(holiday_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    db_holiday = await db.get(Holiday, holiday_id)
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    await db.delete(db_holiday)
    await db.commit()

