import unittest
import uuid
from datetime import date, time
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.schedule_override import ScheduleOverride
from app.models.subject import Subject
from app.models.schedule_rule import ScheduleRule
from app.schemas.schedule import ScheduleOverrideCreate, LessonSlot
from app.routers.schedule import set_schedule_override
from app.routers.system import BackupScheduleOverrideItem, BackupStoredFileItem, FullBackupData, export_full_backup, import_full_backup
from app.services.schedule_service import build_schedule_for_date_range


class TestLessonEventsAndStability(unittest.IsolatedAsyncioTestCase):
    """
    Unit test suite verifying lesson event tagging (Control Work, Test, Essay, Project)
    and full stability across override persistence, schedule construction, and backup operations.
    """

    async def test_set_schedule_override_with_event_type(self):
        """Verify set_schedule_override creates and persists event_type properly."""
        mock_db = AsyncMock()

        # Simulate no existing override
        mock_existing_res = MagicMock()
        mock_existing_res.scalar_one_or_none.return_value = None

        # Simulate refetch full object
        created_id = uuid.uuid4()
        subj_id = uuid.uuid4()
        mock_saved_override = ScheduleOverride(
            id=created_id,
            date=date(2026, 9, 11),
            lesson_order=2,
            subject_id=subj_id,
            original_subject_id=subj_id,
            original_subject_name="Mathematics",
            cabinet="204",
            is_cancelled=False,
            note="Chapter 4 Unit Test",
            event_type="control_work",
        )
        mock_full_res = MagicMock()
        mock_full_res.scalar_one_or_none.return_value = mock_saved_override

        mock_db.execute.side_effect = [mock_existing_res, mock_full_res]
        mock_db.commit = AsyncMock()
        mock_db.add = MagicMock()

        payload = ScheduleOverrideCreate(
            date=date(2026, 9, 11),
            lesson_order=2,
            subject_id=subj_id,
            original_subject_id=subj_id,
            original_subject_name="Mathematics",
            cabinet="204",
            is_cancelled=False,
            note="Chapter 4 Unit Test",
            event_type="control_work",
        )

        resp = await set_schedule_override(override_in=payload, db=mock_db)

        self.assertEqual(resp.event_type, "control_work")
        self.assertEqual(resp.note, "Chapter 4 Unit Test")
        self.assertEqual(resp.lesson_order, 2)
        mock_db.commit.assert_awaited()

    async def test_schedule_service_attaches_event_type(self):
        """Verify schedule_service properly maps override event_type onto LessonSlot."""
        mock_db = AsyncMock()
        subj_id = uuid.uuid4()
        test_subj = Subject(id=subj_id, name="Physics", short_name="Phy", color_hex="#3B82F6")

        # 1. Master schedule rule
        rule = ScheduleRule(
            id=uuid.uuid4(),
            subject_id=subj_id,
            day_of_week=4,  # Thursday
            week_type="both",
            lesson_order=3,
            start_time=time(10, 25),
            end_time=time(11, 10),
            cabinet="301",
            subject=test_subj,
        )
        mock_rules_res = MagicMock()
        mock_rules_res.scalars.return_value.all.return_value = [rule]

        # 2. Schedule override with event_type="test"
        target_date = date(2026, 9, 10)  # Thursday
        override = ScheduleOverride(
            id=uuid.uuid4(),
            date=target_date,
            lesson_order=3,
            subject_id=subj_id,
            original_subject_id=subj_id,
            original_subject_name="Physics",
            cabinet="301",
            is_cancelled=False,
            note="Thermodynamics quiz",
            event_type="test",
            subject=test_subj,
            original_subject=test_subj,
        )
        mock_ov_res = MagicMock()
        mock_ov_res.scalars.return_value.all.return_value = [override]

        # 3. Homework query
        mock_hw_res = MagicMock()
        mock_hw_res.scalars.return_value.all.return_value = []

        mock_db.execute.side_effect = [mock_rules_res, mock_ov_res, mock_hw_res]

        days = await build_schedule_for_date_range(
            db=mock_db,
            start_date=target_date,
            end_date=target_date,
        )

        self.assertEqual(len(days), 1)
        self.assertEqual(len(days[0].lessons), 1)
        lesson_slot: LessonSlot = days[0].lessons[0]
        self.assertEqual(lesson_slot.event_type, "test")
        self.assertEqual(lesson_slot.override_note, "Thermodynamics quiz")
        self.assertTrue(lesson_slot.is_override)

    async def test_backup_event_type_roundtrip(self):
        """Verify BackupScheduleOverrideItem preserves event_type values."""
        item = BackupScheduleOverrideItem(
            date="2026-09-15",
            lesson_order=1,
            event_type="project",
            note="Science Fair Presentation",
        )
        data = item.model_dump()
        self.assertEqual(data["event_type"], "project")
        self.assertEqual(data["note"], "Science Fair Presentation")

        restored = BackupScheduleOverrideItem.model_validate(data)
        self.assertEqual(restored.event_type, "project")


if __name__ == "__main__":
    unittest.main()
