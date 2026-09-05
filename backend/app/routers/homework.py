import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.homework import HomeworkEntry
from app.schemas.homework import HomeworkRead, HomeworkCreate, HomeworkUpdate

router = APIRouter(prefix="/api/v1/homework", tags=["homework"])

@router.get("/", response_model=list[HomeworkRead])
async def list_homework(
    target_date: date | None = Query(None, alias="date"),
    subject_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get homework entries."""
    stmt = select(HomeworkEntry)
    if target_date:
        stmt = stmt.where(HomeworkEntry.due_date == target_date)
    if subject_id:
        stmt = stmt.where(HomeworkEntry.subject_id == subject_id)
        
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=HomeworkRead, status_code=status.HTTP_201_CREATED)
async def create_homework(hw_in: HomeworkCreate, db: AsyncSession = Depends(get_db)):
    """Create a new homework entry."""
    hw = HomeworkEntry(**hw_in.model_dump())
    db.add(hw)
    await db.commit()
    await db.refresh(hw)
    return hw

@router.patch("/{id}", response_model=HomeworkRead)
async def update_homework(id: uuid.UUID, hw_in: HomeworkUpdate, db: AsyncSession = Depends(get_db)):
    """Update a homework entry."""
    hw = await db.get(HomeworkEntry, id)
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
        
    update_data = hw_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(hw, key, value)
        
    await db.commit()
    await db.refresh(hw)
    return hw

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_homework(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a homework entry."""
    hw = await db.get(HomeworkEntry, id)
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
        
    await db.delete(hw)
    await db.commit()
    return None
