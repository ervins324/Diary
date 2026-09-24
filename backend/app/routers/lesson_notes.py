import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.lesson_note import LessonNote
from app.schemas.lesson_note import LessonNoteRead, LessonNoteCreate, LessonNoteUpdate

router = APIRouter(prefix="/api/v1/lesson-notes", tags=["lesson-notes"])

@router.get("", response_model=list[LessonNoteRead])
@router.get("/", response_model=list[LessonNoteRead], include_in_schema=False)
async def list_lesson_notes(
    target_date: date | None = Query(None, alias="date"),
    lesson_order: int | None = Query(None),
    subject_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get lesson notes filtered by date, lesson_order, or subject."""
    stmt = select(LessonNote).order_by(LessonNote.created_at)
    if target_date:
        stmt = stmt.where(LessonNote.date == target_date)
    if lesson_order is not None:
        stmt = stmt.where(LessonNote.lesson_order == lesson_order)
    if subject_id:
        stmt = stmt.where(LessonNote.subject_id == subject_id)

    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=LessonNoteRead, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=LessonNoteRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_lesson_note(note_in: LessonNoteCreate, db: AsyncSession = Depends(get_db)):
    """Create a new note for a lesson."""
    note = LessonNote(**note_in.model_dump())
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note

@router.patch("/{id}", response_model=LessonNoteRead)
@router.put("/{id}", response_model=LessonNoteRead, include_in_schema=False)
async def update_lesson_note(id: uuid.UUID, note_in: LessonNoteUpdate, db: AsyncSession = Depends(get_db)):
    """Update a lesson note's text."""
    note = await db.get(LessonNote, id)
    if not note:
        raise HTTPException(status_code=404, detail="Lesson note not found")

    update_data = note_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(note, key, value)

    await db.commit()
    await db.refresh(note)
    return note

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson_note(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a lesson note."""
    note = await db.get(LessonNote, id)
    if not note:
        raise HTTPException(status_code=404, detail="Lesson note not found")

    await db.delete(note)
    await db.commit()
    return None
