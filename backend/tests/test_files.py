import unittest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.stored_file import StoredFile
from app.routers.files import delete_file, get_file, upload_file
from fastapi import HTTPException, UploadFile
import io


class TestFilesRouter(unittest.IsolatedAsyncioTestCase):
    """
    Unit tests for file uploads, PPT/PPTX normalization, and download header handling.
    """

    async def test_upload_pptx_normalizes_content_type(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock() if hasattr(mock_db, 'add') else lambda x: None
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        file_data = b"PK\x03\x04test_presentation_content"
        upload = UploadFile(
            file=io.BytesIO(file_data),
            filename="lecture_presentation.pptx",
            headers={"content-type": "application/octet-stream"},
        )

        with patch("app.routers.files.StoredFile") as MockStoredFile:
            instance = MagicMock()
            instance.id = uuid.uuid4()
            instance.filename = "lecture_presentation.pptx"
            instance.content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            instance.size = len(file_data)
            MockStoredFile.return_value = instance

            res = await upload_file(file=upload, db=mock_db)

            self.assertIn("id", res)
            self.assertEqual(res["filename"], "lecture_presentation.pptx")
            self.assertEqual(
                res["content_type"],
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            )
            self.assertEqual(res["url"], f"/api/v1/files/{instance.id}")

    async def test_get_file_sets_attachment_disposition_for_pptx(self):
        mock_db = AsyncMock()
        file_id = uuid.uuid4()

        stored = StoredFile(
            id=file_id,
            filename="science_project.pptx",
            content_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            size=1024,
            file_data=b"presentation_bytes",
        )
        mock_db.get = AsyncMock(return_value=stored)

        resp = await get_file(file_id=file_id, download=False, db=mock_db)

        self.assertEqual(resp.media_type, stored.content_type)
        self.assertIn("attachment", resp.headers["Content-Disposition"])
        self.assertIn("science_project.pptx", resp.headers["Content-Disposition"])

    async def test_get_file_inline_for_pdf_unless_download_requested(self):
        mock_db = AsyncMock()
        file_id = uuid.uuid4()

        stored = StoredFile(
            id=file_id,
            filename="document.pdf",
            content_type="application/pdf",
            size=512,
            file_data=b"%PDF-1.4...",
        )
        mock_db.get = AsyncMock(return_value=stored)

        # Default preview -> inline
        resp_inline = await get_file(file_id=file_id, download=False, db=mock_db)
        self.assertIn("inline", resp_inline.headers["Content-Disposition"])

        # Explicit download -> attachment
        resp_dl = await get_file(file_id=file_id, download=True, db=mock_db)
        self.assertIn("attachment", resp_dl.headers["Content-Disposition"])

    async def test_get_file_not_found_raises_404(self):
        mock_db = AsyncMock()
        mock_db.get = AsyncMock(return_value=None)

        with self.assertRaises(HTTPException) as ctx:
            await get_file(file_id=uuid.uuid4(), db=mock_db)
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    from unittest.mock import MagicMock
    unittest.main()
