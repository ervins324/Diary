import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models.subject import Subject
from app.models.homework import HomeworkEntry
from app.models.schedule_rule import ScheduleRule
from app.models.bell_schedule import BellSchedule
from app.schemas.subject import SubjectRead, SubjectCreate, SubjectUpdate

router = APIRouter(prefix="/api/v1/subjects", tags=["subjects"])

@router.get("", response_model=list[SubjectRead])
@router.get("/", response_model=list[SubjectRead], include_in_schema=False)
async def list_subjects(db: AsyncSession = Depends(get_db)):
    """Get all subjects."""
    result = await db.execute(select(Subject))
    return result.scalars().all()

@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=SubjectRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_subject(subject_in: SubjectCreate, db: AsyncSession = Depends(get_db)):
    """Create a new subject."""
    subject = Subject(**subject_in.model_dump())
    db.add(subject)
    try:
        await db.commit()
        await db.refresh(subject)
        return subject
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Subject with this name might already exist")

@router.get("/{id}", response_model=SubjectRead)
async def get_subject(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get subject by ID."""
    subject = await db.get(Subject, id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject

@router.patch("/{id}", response_model=SubjectRead)
async def update_subject(id: uuid.UUID, subject_in: SubjectUpdate, db: AsyncSession = Depends(get_db)):
    """Update subject."""
    subject = await db.get(Subject, id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    update_data = subject_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(subject, key, value)
        
    await db.commit()
    await db.refresh(subject)
    return subject

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete subject."""
    subject = await db.get(Subject, id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    await db.delete(subject)
    await db.commit()
    return None


@router.post("/clear-all-data", status_code=status.HTTP_200_OK)
@router.delete("/clear-all-data", status_code=status.HTTP_200_OK)
async def clear_all_data(db: AsyncSession = Depends(get_db)):
    """
    Permanently delete all data across the application:
    1. Homework entries
    2. Schedule rules
    3. Bell schedule slots
    4. Subjects
    """
    await db.execute(delete(HomeworkEntry))
    await db.execute(delete(ScheduleRule))
    await db.execute(delete(BellSchedule))
    await db.execute(delete(Subject))
    await db.commit()
    return {"status": "ok", "message": "All data cleared successfully"}

