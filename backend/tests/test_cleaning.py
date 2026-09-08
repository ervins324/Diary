import unittest
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.homework import HomeworkEntry
from app.models.schedule_override import ScheduleOverride
from app.models.stored_file import StoredFile
from app.routers.system import CleanDataRequest, clean_data, get_storage_stats
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
        mock_hw_res = MagicMock()
        mock_hw_res.rowcount = 5
        mock_ov_res = MagicMock()
        mock_ov_res.rowcount = 2

        # Mock file query: 1 active, 1 orphaned
        active_uuid = uuid.uuid4()
        orphan_uuid = uuid.uuid4()

        mock_hw_att_res = MagicMock()
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

        mock_files_res = MagicMock()
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

    async def test_get_storage_stats_breakdown(self):
        """
        Verify get_storage_stats computes size for files (PDF, PPTX, images)
        and database rows, proving files consume the vast majority of space.
        """
        mock_db = AsyncMock()

        # 1. Stored files aggregate query (.one())
        mock_file_stats = MagicMock()
        mock_file_stats.one.return_value = (3, 5_242_880 + 8_388_608 + 1_048_576)

        # 2. Stored files breakdown query (.all())
        mock_files_res = MagicMock()
        mock_files_res.all.return_value = [
            ("document.pdf", "application/pdf", 5_242_880),  # 5 MB
            ("slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", 8_388_608),  # 8 MB
            ("photo.png", "image/png", 1_048_576),  # 1 MB
        ]

        # 3. Homework entries query
        hw_sample = HomeworkEntry(
            id=uuid.uuid4(),
            subject_id=uuid.uuid4(),
            due_date=date(2026, 9, 10),
            lesson_order=1,
            text="Read chapter 4 and solve exercises 1 to 10.",
            is_completed=False,
            attachments=[{"id": "file-1", "name": "document.pdf"}],
        )
        mock_hw_res = MagicMock()
        mock_hw_res.scalars.return_value.all.return_value = [hw_sample]

        # 4. Counts queries: rules, overrides, bells, subjects
        mock_rules_count = MagicMock()
        mock_rules_count.scalar.return_value = 25

        mock_overrides_count = MagicMock()
        mock_overrides_count.scalar.return_value = 4

        mock_bells_count = MagicMock()
        mock_bells_count.scalar.return_value = 7

        mock_subjects_count = MagicMock()
        mock_subjects_count.scalar.return_value = 12

        mock_db.execute = AsyncMock(
            side_effect=[
                mock_file_stats,
                mock_files_res,
                mock_hw_res,
                mock_rules_count,
                mock_overrides_count,
                mock_bells_count,
                mock_subjects_count,
            ]
        )

        stats = await get_storage_stats(db=mock_db)

        self.assertIn("total_bytes", stats)
        self.assertIn("categories", stats)
        self.assertEqual(len(stats["categories"]), 6)

        # File category checks
        files_cat = next(c for c in stats["categories"] if c["id"] == "files")
        self.assertTrue(files_cat["is_file_storage"])
        self.assertEqual(files_cat["count"], 3)
        self.assertEqual(files_cat["bytes"], 5_242_880 + 8_388_608 + 1_048_576)  # ~14.68 MB
        self.assertEqual(files_cat["subcategories"]["pdf"]["count"], 1)
        self.assertEqual(files_cat["subcategories"]["presentation"]["count"], 1)
        self.assertEqual(files_cat["subcategories"]["images"]["count"], 1)

        # Confirm files account for over 99% of total storage compared to text rows
        total_bytes = stats["total_bytes"]
        file_share = (files_cat["bytes"] / total_bytes) * 100
        self.assertGreater(file_share, 99.0)

    async def test_get_storage_stats_empty(self):
        """Verify get_storage_stats handles empty database without division errors."""
        mock_db = AsyncMock()

        mock_file_stats = MagicMock()
        mock_file_stats.one.return_value = (0, 0)

        mock_files_res = MagicMock()
        mock_files_res.all.return_value = []

        mock_hw_res = MagicMock()
        mock_hw_res.scalars.return_value.all.return_value = []

        mock_zero_count = MagicMock()
        mock_zero_count.scalar.return_value = 0

        mock_db.execute = AsyncMock(
            side_effect=[
                mock_file_stats,
                mock_files_res,
                mock_hw_res,
                mock_zero_count,
                mock_zero_count,
                mock_zero_count,
                mock_zero_count,
            ]
        )

        stats = await get_storage_stats(db=mock_db)
        self.assertEqual(stats["total_bytes"], 0)
        self.assertEqual(len(stats["categories"]), 6)


if __name__ == "__main__":
    unittest.main()
