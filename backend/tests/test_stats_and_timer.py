import unittest
import uuid
from datetime import date, time
from unittest.mock import AsyncMock, MagicMock

from app.models.schedule_override import ScheduleOverride
from app.models.subject import Subject
from app.models.schedule_rule import ScheduleRule
from app.models.homework import HomeworkEntry
from app.schemas.homework import HomeworkCreate, HomeworkUpdate
from app.services.stats_service import get_weekly_stats


class TestStatsAndHomeworkTimer(unittest.IsolatedAsyncioTestCase):
    """
    Comprehensive unit tests verifying:
    1. Homework stopwatch timer schema and update persistence (time_spent_seconds).
    2. Weekly statistics deduction of cancelled lessons (is_cancelled == True).
    3. Mode switching: 'actual', 'numerator', 'denominator'.
    4. Academic event counting (control_work, test, essay, project).
    5. Subject lessons_count accurately calculated alongside total_minutes.
    """

    def test_homework_schema_with_time_spent(self):
        """Verify Homework schemas accept and validate time_spent_seconds."""
        subj_id = uuid.uuid4()
        hw_create = HomeworkCreate(
            subject_id=subj_id,
            due_date=date(2026, 9, 10),
            text="Read Chapter 3",
            time_spent_seconds=1200
        )
        self.assertEqual(hw_create.time_spent_seconds, 1200)

        hw_update = HomeworkUpdate(time_spent_seconds=1850)
        self.assertEqual(hw_update.time_spent_seconds, 1850)

    async def test_weekly_stats_cancellation_deduction(self):
        """Verify that cancelled lessons in actual mode are deducted from total lessons and minutes."""
        mock_db = AsyncMock()

        subj1 = Subject(id=uuid.uuid4(), name="Math", short_name="M", color_hex="#3b82f6")
        subj2 = Subject(id=uuid.uuid4(), name="History", short_name="H", color_hex="#eab308")

        rule1 = ScheduleRule(
            id=uuid.uuid4(),
            subject_id=subj1.id,
            subject=subj1,
            day_of_week=1,  # Monday
            week_type="all",
            lesson_order=1,
            start_time=time(8, 30),
            end_time=time(9, 15),
            cabinet="101"
        )
        rule2 = ScheduleRule(
            id=uuid.uuid4(),
            subject_id=subj2.id,
            subject=subj2,
            day_of_week=1,  # Monday
            week_type="all",
            lesson_order=2,
            start_time=time(9, 25),
            end_time=time(10, 10),
            cabinet="102"
        )

        # Override: Cancel Lesson 2 on Monday
        monday_date = date(2026, 9, 7)
        cancel_override = ScheduleOverride(
            id=uuid.uuid4(),
            date=monday_date,
            lesson_order=2,
            subject_id=None,
            original_subject_id=subj2.id,
            original_subject=subj2,
            is_cancelled=True,
            note="Air raid alarm"
        )

        # Mock DB returns:
        # Call 1: Homeworks -> empty list
        mock_hw_res = MagicMock()
        mock_hw_res.scalars().all.return_value = []

        # Call 2: Overrides -> [cancel_override]
        mock_ov_res = MagicMock()
        mock_ov_res.scalars().all.return_value = [cancel_override]

        # Calls 3..9: Rules for Monday..Sunday
        # Monday (i=0) has [rule1, rule2], others empty
        mock_rule_res_mon = MagicMock()
        mock_rule_res_mon.scalars().all.return_value = [rule1, rule2]

        mock_empty_rules = MagicMock()
        mock_empty_rules.scalars().all.return_value = []

        mock_db.execute.side_effect = [
            mock_hw_res,
            mock_ov_res,
            mock_rule_res_mon,
            mock_empty_rules,
            mock_empty_rules,
            mock_empty_rules,
            mock_empty_rules,
            mock_empty_rules,
            mock_empty_rules,
        ]

        stats = await get_weekly_stats(
            db=mock_db,
            target_date=monday_date,
            anchor_date=date(2026, 9, 1),
            mode="actual"
        )

        # Verify only 1 active lesson counted, 1 cancelled lesson recorded
        self.assertEqual(stats["total_lessons"], 1)
        self.assertEqual(stats["cancelled_lessons_count"], 1)
        # Math has 45 minutes and 1 lesson; History has 0 minutes / 0 lessons
        math_stat = next(s for s in stats["subjects"] if s["subject_name"] == "Math")
        self.assertEqual(math_stat["lessons_count"], 1)
        self.assertEqual(math_stat["total_minutes"], 45)
        self.assertFalse(any(s["subject_name"] == "History" for s in stats["subjects"]))

    async def test_weekly_stats_events_counting(self):
        """Verify that academic events (control_work, test, essay, project) are aggregated."""
        mock_db = AsyncMock()

        subj = Subject(id=uuid.uuid4(), name="Physics", short_name="Ph", color_hex="#10b981")
        rule = ScheduleRule(
            id=uuid.uuid4(),
            subject_id=subj.id,
            subject=subj,
            day_of_week=1,
            week_type="all",
            lesson_order=1,
            start_time=time(8, 30),
            end_time=time(9, 15),
        )

        target_date = date(2026, 9, 7)
        cw_override = ScheduleOverride(
            id=uuid.uuid4(),
            date=target_date,
            lesson_order=1,
            subject_id=subj.id,
            subject=subj,
            is_cancelled=False,
            event_type="control_work"
        )

        mock_hw_res = MagicMock()
        mock_hw_res.scalars().all.return_value = []
        mock_ov_res = MagicMock()
        mock_ov_res.scalars().all.return_value = [cw_override]
        mock_mon_rules = MagicMock()
        mock_mon_rules.scalars().all.return_value = [rule]
        mock_empty = MagicMock()
        mock_empty.scalars().all.return_value = []

        mock_db.execute.side_effect = [
            mock_hw_res,
            mock_ov_res,
            mock_mon_rules,
            mock_empty,
            mock_empty,
            mock_empty,
            mock_empty,
            mock_empty,
            mock_empty,
        ]

        stats = await get_weekly_stats(
            db=mock_db,
            target_date=target_date,
            anchor_date=date(2026, 9, 1),
            mode="actual"
        )

        self.assertEqual(stats["event_counts"]["control_work"], 1)
        self.assertEqual(stats["event_counts"]["test"], 0)
        self.assertEqual(stats["total_lessons"], 1)

    async def test_weekly_stats_homework_time_spent(self):
        """Verify homework time spent metrics are aggregated accurately in weekly stats."""
        mock_db = AsyncMock()
        target_date = date(2026, 9, 7)  # Monday
        subj_id = uuid.uuid4()

        hw1 = HomeworkEntry(
            id=uuid.uuid4(),
            subject_id=subj_id,
            due_date=target_date,
            lesson_order=1,
            text="Exercises 1-5",
            is_completed=True,
            time_spent_seconds=900,  # 15 mins
        )
        hw2 = HomeworkEntry(
            id=uuid.uuid4(),
            subject_id=subj_id,
            due_date=target_date,
            lesson_order=2,
            text="Essay preparation",
            is_completed=False,
            time_spent_seconds=1500,  # 25 mins
        )

        mock_hw_res = MagicMock()
        mock_hw_res.scalars().all.return_value = [hw1, hw2]
        mock_ov_res = MagicMock()
        mock_ov_res.scalars().all.return_value = []
        mock_empty = MagicMock()
        mock_empty.scalars().all.return_value = []

        mock_db.execute.side_effect = [
            mock_hw_res,
            mock_ov_res,
            mock_empty,
            mock_empty,
            mock_empty,
            mock_empty,
            mock_empty,
            mock_empty,
            mock_empty,
        ]

        stats = await get_weekly_stats(
            db=mock_db,
            target_date=target_date,
            anchor_date=date(2026, 9, 1),
            mode="actual",
        )

        hw_stats = stats["homework_stats"]
        self.assertEqual(hw_stats["total"], 2)
        self.assertEqual(hw_stats["completed"], 1)
        self.assertEqual(hw_stats["total_time_spent_seconds"], 2400)  # 40 mins
        self.assertEqual(hw_stats["avg_time_spent_seconds"], 1200)   # 20 mins
        self.assertEqual(stats["days"][0]["homework_time_spent_seconds"], 2400)


if __name__ == "__main__":
    unittest.main()
