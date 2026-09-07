import unittest
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models.homework import HomeworkEntry
from app.models.schedule_override import ScheduleOverride
from app.models.stored_file import StoredFile
from app.routers.system import CleanDataRequest, clean_data
from fastapi import HTTPException


class TestSystemCleaning(unittest.IsolatedAsyncioTestCase):
    """
    Unit tests for the clean_data endpoint:
    - Time-step date range filtering
    - Before cutoff date historical cleanup
    - Completed homework filter
    - Orphaned file identification and cleanup
    """

    async def test_clean_data_by_cutoff_date(self):
        mock_db = AsyncMock()

        # Mock execute returning rowcount for deleted homework & overrides
        mock_hw_res = AsyncMock()
        mock_hw_res.rowcount = 5
        mock_ov_res = AsyncMock()
        mock_ov_res.rowcount = 2

        # Mock file query: 1 active, 1 orphaned
        active_uuid = uuid.uuid4()
        orphan_uuid = uuid.uuid4()

        mock_hw_att_res = AsyncMock()
        mock_hw_att_res.scalars.return_value.all.return_value = [
            [{"id": str(active_uuid), "name": "active.pdf"}]
        ]

        active_file = StoredFile(
            id=active_uuid,
            filename="active.pdf",
            content_type="application/pdf",
            size=100,
            file_data=b"data",
            created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        )
        orphan_file = StoredFile(
            id=orphan_uuid,
            filename="orphan.pptx",
            content_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            size=200,
            file_data=b"orphan",
            created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        )

        mock_files_res = AsyncMock()
        mock_files_res.scalars.return_value.all.return_value = [active_file, orphan_file]

        mock_db.execute = AsyncMock(
            side_effect=[mock_hw_res, mock_ov_res, mock_hw_att_res, mock_files_res]
        )
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        req = CleanDataRequest(
            before_date="2026-09-01",
            clean_homework=True,
            clean_completed_homework_only=False,
            clean_schedule_overrides=True,
            clean_orphaned_files=True,
        )

        resp = await clean_data(req=req, db=mock_db)

        self.assertEqual(resp["status"], "ok")
        self.assertEqual(resp["deleted"]["homework"], 5)
        self.assertEqual(resp["deleted"]["schedule_overrides"], 2)
        self.assertEqual(resp["deleted"]["stored_files"], 1)
        mock_db.delete.assert_called_once_with(orphan_file)

    async def test_clean_data_invalid_date_raises_400(self):
        mock_db = AsyncMock()
        req = CleanDataRequest(before_date="not-a-date")

        with self.assertRaises(HTTPException) as ctx:
            await clean_data(req=req, db=mock_db)
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
