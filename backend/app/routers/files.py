import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.stored_file import StoredFile

router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload and persist a file (PDF, image, etc.) into PostgreSQL.
    Returns metadata and access URL.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    stored = StoredFile(
        filename=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        size=len(content),
        file_data=content,
    )
    db.add(stored)
    await db.commit()
    await db.refresh(stored)

    return {
        "id": str(stored.id),
        "filename": stored.filename,
        "content_type": stored.content_type,
        "size": stored.size,
        "url": f"/api/v1/files/{stored.id}",
    }


@router.get("/{file_id}")
async def get_file(file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Retrieve and stream a stored file by ID with inline preview headers.
    """
    stored = await db.get(StoredFile, file_id)
    if not stored:
        raise HTTPException(status_code=404, detail="File not found")

    # Clean filename for Content-Disposition header
    safe_filename = stored.filename.replace('"', '').replace(';', '')
    return Response(
        content=stored.file_data,
        media_type=stored.content_type,
        headers={
            "Content-Disposition": f'inline; filename="{safe_filename}"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Delete a stored file by ID.
    """
    stored = await db.get(StoredFile, file_id)
    if not stored:
        raise HTTPException(status_code=404, detail="File not found")

    await db.delete(stored)
    await db.commit()
    return None
