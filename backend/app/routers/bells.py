import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.config import settings
from app.models.bell_schedule import BellSchedule
from app.schemas.bell_schedule import (
    BellSlotRead,
    BellSlotCreate,
    BellSlotUpdate,
    BellBulkCommitRequest,
    AiParseBellsResponse,
    JsonBellsParseRequest,
)
from app.services.ai_parser import parse_bells_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bells", tags=["bells"])


@router.get("", response_model=list[BellSlotRead])
@router.get("/", response_model=list[BellSlotRead], include_in_schema=False)
async def list_bells(db: AsyncSession = Depends(get_db)):
    """
    Get all bell schedule slots ordered by lesson order.
    """
    stmt = select(BellSchedule).order_by(BellSchedule.lesson_order)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=BellSlotRead, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=BellSlotRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_or_update_bell(slot_in: BellSlotCreate, db: AsyncSession = Depends(get_db)):
    """
    Create or update a bell slot by lesson_order.
    """
    stmt = select(BellSchedule).where(BellSchedule.lesson_order == slot_in.lesson_order)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.start_time = slot_in.start_time
        existing.end_time = slot_in.end_time
        existing.name = slot_in.name
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        new_slot = BellSchedule(
            lesson_order=slot_in.lesson_order,
            start_time=slot_in.start_time,
            end_time=slot_in.end_time,
            name=slot_in.name,
        )
        db.add(new_slot)
        await db.commit()
        await db.refresh(new_slot)
        return new_slot


@router.put("/bulk", response_model=list[BellSlotRead])
async def bulk_replace_bells(request: BellBulkCommitRequest, db: AsyncSession = Depends(get_db)):
    """
    Replace all bell slots with a new set atomically.
    """
    # Clear existing bell schedules
    await db.execute(delete(BellSchedule))

    new_slots = []
    for slot_in in request.slots:
        slot = BellSchedule(
            lesson_order=slot_in.lesson_order,
            start_time=slot_in.start_time,
            end_time=slot_in.end_time,
            name=slot_in.name,
        )
        db.add(slot)
        new_slots.append(slot)

    await db.commit()

    # Re-query ordered list
    stmt = select(BellSchedule).order_by(BellSchedule.lesson_order)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/{id}", response_model=BellSlotRead)
async def update_bell(id: uuid.UUID, slot_in: BellSlotUpdate, db: AsyncSession = Depends(get_db)):
    """
    Update a bell slot by ID.
    """
    slot = await db.get(BellSchedule, id)
    if not slot:
        raise HTTPException(status_code=404, detail="Bell slot not found")

    update_data = slot_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(slot, key, value)

    await db.commit()
    await db.refresh(slot)
    return slot


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bell(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Delete a bell slot by ID.
    """
    slot = await db.get(BellSchedule, id)
    if not slot:
        raise HTTPException(status_code=404, detail="Bell slot not found")

    await db.delete(slot)
    await db.commit()
    return None


@router.post("/ai-parse", response_model=AiParseBellsResponse)
async def ai_parse_bells_endpoint(file: UploadFile = File(...)):
    """
    Parse an image of a bell schedule (розклад дзвінків) using Gemini 3.5 Flash.
    Returns structured slots for client review.
    """
    logger.info(f"POST /api/v1/bells/ai-parse received file: '{file.filename}' ({file.content_type})")
    image_bytes = await file.read()
    if not image_bytes:
        logger.warning("Empty image uploaded for bells parsing")
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    logger.info(f"Read {len(image_bytes)} bytes. Calling parse_bells_image...")
    result = await parse_bells_image(
        image_bytes=image_bytes,
        filename=file.filename or "bells.jpg",
        api_key=settings.GEMINI_API_KEY,
        content_type=file.content_type,
    )
    logger.info(f"Successfully parsed bells schedule: extracted {len(result.slots)} slots")
    return result


@router.post("/parse-json", response_model=AiParseBellsResponse)
async def parse_bells_json(request: JsonBellsParseRequest):
    """
    Parse a JSON string representing bell slots (typically from external AI).
    Validates structure, sorts by order, and returns for client review.
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
        logger.warning(f"Failed to decode bells JSON: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

    # Normalize if the root object is a list of slots
    if isinstance(data, list):
        data = {"slots": data}

    if not isinstance(data, dict) or "slots" not in data:
        raise HTTPException(status_code=422, detail="JSON structure must contain a 'slots' array.")

    try:
        validated = AiParseBellsResponse.model_validate(data)
    except Exception as e:
        logger.warning(f"Validation failed for user-submitted bells JSON: {e}")
        raise HTTPException(status_code=422, detail=f"Bells JSON validation error: {str(e)}")

    validated.slots.sort(key=lambda s: s.order)
    return validated

