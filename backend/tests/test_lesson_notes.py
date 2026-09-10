import unittest
import uuid
from datetime import date, datetime
from app.models.lesson_note import LessonNote
from app.schemas.lesson_note import LessonNoteCreate, LessonNoteUpdate, LessonNoteRead

class TestLessonNotes(unittest.TestCase):
    def test_lesson_note_schemas(self):
        """Verify LessonNote Pydantic schemas validate correctly."""
        subj_id = uuid.uuid4()
        create_schema = LessonNoteCreate(
            subject_id=subj_id,
            date=date(2026, 9, 10),
            lesson_order=1,
            text="Bring geometry compass and ruler to next class",
        )
        self.assertEqual(create_schema.lesson_order, 1)
        self.assertEqual(create_schema.text, "Bring geometry compass and ruler to next class")

        update_schema = LessonNoteUpdate(text="Updated note text")
        self.assertEqual(update_schema.text, "Updated note text")

        read_schema = LessonNoteRead(
            id=uuid.uuid4(),
            subject_id=subj_id,
            date=date(2026, 9, 10),
            lesson_order=1,
            text="Test note",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        self.assertEqual(read_schema.text, "Test note")

if __name__ == "__main__":
    unittest.main()
