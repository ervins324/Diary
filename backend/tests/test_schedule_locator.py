import unittest
import uuid
from datetime import date, time, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.schemas.schedule import (
    DaySchedule,
    LessonSlot,
    NextLessonResponse,
    PreviousLessonResponse,
)
from app.schemas.subject import SubjectRead
from app.services.schedule_service import (
    find_closest_next_lesson,
    find_closest_previous_lesson,
)


def make_subject(name: str, sub_id: uuid.UUID | None = None) -> SubjectRead:
    return SubjectRead(
        id=sub_id or uuid.uuid4(),
        name=name,
        short_name=name[:4],
        color_hex="#3b82f6",
        default_cabinet="101",
    )


def make_lesson(
    d: date,
    order: int,
    subject: SubjectRead,
    start_time: time = time(8, 30),
    end_time: time = time(9, 15),
    is_cancelled: bool = False,
) -> LessonSlot:
    return LessonSlot(
        date=d,
        lesson_order=order,
        subject=subject,
        start_time=start_time,
        end_time=end_time,
        cabinet="101",
        homework=[],
        is_override=False,
        is_cancelled=is_cancelled,
        override_note=None,
    )


class TestScheduleLocator(unittest.IsolatedAsyncioTestCase):
    """
    Unit tests for schedule navigation:
    - find_closest_next_lesson
    - find_closest_previous_lesson
    """

    async def asyncSetUp(self):
        self.sub_math = make_subject("Math")
        self.sub_history = make_subject("History")
        self.anchor_date = date(2026, 9, 1)

    @patch("app.services.schedule_service.get_schedule_for_range")
    async def test_find_next_lesson_skips_current_slot_on_same_day(self, mock_get_sched):
        # Day 1: Math at order 1, Math at order 3
        d1 = date(2026, 9, 7)
        l1 = make_lesson(d1, 1, self.sub_math)
        l2 = make_lesson(d1, 2, self.sub_history)
        l3 = make_lesson(d1, 3, self.sub_math)

        mock_get_sched.return_value = [
            DaySchedule(date=d1, day_name="Monday", week_type="numerator", lessons=[l1, l2, l3])
        ]

        mock_db = AsyncMock()
        # Clicking from order 1 must find order 3, NOT order 1
        res = await find_closest_next_lesson(
            db=mock_db,
            subject_id=self.sub_math.id,
            anchor_date=self.anchor_date,
            current_date=d1,
            current_lesson_order=1,
        )

        self.assertIsNotNone(res)
        self.assertEqual(res.date, d1)
        self.assertEqual(res.lesson_order, 3)

    @patch("app.services.schedule_service.get_schedule_for_range")
    async def test_find_next_lesson_jumps_to_following_day(self, mock_get_sched):
        # Future dates: Day 1: Math at order 1; Day 3: Math at order 2
        d1 = date(2030, 9, 9)
        d3 = date(2030, 9, 11)
        l1 = make_lesson(d1, 1, self.sub_math)
        l2 = make_lesson(d3, 2, self.sub_math)

        mock_get_sched.return_value = [
            DaySchedule(date=d1, day_name="Monday", week_type="numerator", lessons=[l1]),
            DaySchedule(date=d3, day_name="Wednesday", week_type="numerator", lessons=[l2]),
        ]

        mock_db = AsyncMock()
        res = await find_closest_next_lesson(
            db=mock_db,
            subject_id=self.sub_math.id,
            anchor_date=self.anchor_date,
            current_date=d1,
            current_lesson_order=1,
        )

        self.assertIsNotNone(res)
        self.assertEqual(res.date, d3)
        self.assertEqual(res.lesson_order, 2)

    @patch("app.services.schedule_service.get_schedule_for_range")
    async def test_find_previous_lesson_skips_current_slot_on_same_day(self, mock_get_sched):
        # Day 1: Math at order 1, Math at order 4
        d1 = date(2026, 9, 7)
        l1 = make_lesson(d1, 1, self.sub_math)
        l2 = make_lesson(d1, 4, self.sub_math)

        mock_get_sched.return_value = [
            DaySchedule(date=d1, day_name="Monday", week_type="numerator", lessons=[l1, l2])
        ]

        mock_db = AsyncMock()
        # Clicking from order 4 must return order 1
        res = await find_closest_previous_lesson(
            db=mock_db,
            subject_id=self.sub_math.id,
            anchor_date=self.anchor_date,
            current_date=d1,
            current_lesson_order=4,
        )

        self.assertIsNotNone(res)
        self.assertEqual(res.date, d1)
        self.assertEqual(res.lesson_order, 1)

    @patch("app.services.schedule_service.get_schedule_for_range")
    async def test_find_previous_lesson_jumps_to_earlier_day(self, mock_get_sched):
        # Day 1 (Mon): Math at order 2
        # Day 3 (Wed): Math at order 1
        d1 = date(2026, 9, 7)
        d3 = date(2026, 9, 9)
        l1 = make_lesson(d1, 2, self.sub_math)
        l3 = make_lesson(d3, 1, self.sub_math)

        mock_get_sched.return_value = [
            DaySchedule(date=d1, day_name="Monday", week_type="numerator", lessons=[l1]),
            DaySchedule(date=d3, day_name="Wednesday", week_type="numerator", lessons=[l3]),
        ]

        mock_db = AsyncMock()
        # Clicking from Wed order 1 must return Mon order 2
        res = await find_closest_previous_lesson(
            db=mock_db,
            subject_id=self.sub_math.id,
            anchor_date=self.anchor_date,
            current_date=d3,
            current_lesson_order=1,
        )

        self.assertIsNotNone(res)
        self.assertEqual(res.date, d1)
        self.assertEqual(res.lesson_order, 2)

    @patch("app.services.schedule_service.get_schedule_for_range")
    async def test_find_previous_lesson_none_when_no_prior_class(self, mock_get_sched):
        d1 = date(2026, 9, 7)
        l1 = make_lesson(d1, 1, self.sub_math)

        mock_get_sched.return_value = [
            DaySchedule(date=d1, day_name="Monday", week_type="numerator", lessons=[l1])
        ]

        mock_db = AsyncMock()
        # Clicking from Mon order 1 with no earlier lessons
        res = await find_closest_previous_lesson(
            db=mock_db,
            subject_id=self.sub_math.id,
            anchor_date=self.anchor_date,
            current_date=d1,
            current_lesson_order=1,
        )

        self.assertIsNone(res)


if __name__ == "__main__":
    unittest.main()
