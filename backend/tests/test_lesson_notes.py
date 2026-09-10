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
            images=["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"],
            attachments=[{"id": "file-123", "name": "presentation.pptx", "type": "presentation", "url": "/api/v1/files/file-123"}],
        )
        self.assertEqual(create_schema.lesson_order, 1)
        self.assertEqual(create_schema.text, "Bring geometry compass and ruler to next class")
        self.assertEqual(len(create_schema.images), 1)
        self.assertEqual(len(create_schema.attachments), 1)

        update_schema = LessonNoteUpdate(
            text="Updated note text",
            images=[],
            attachments=[{"name": "lecture.pdf", "type": "pdf", "url": "https://example.com/lecture.pdf"}],
        )
        self.assertEqual(update_schema.text, "Updated note text")
        self.assertEqual(len(update_schema.attachments), 1)

        read_schema = LessonNoteRead(
            id=uuid.uuid4(),
            subject_id=subj_id,
            date=date(2026, 9, 10),
            lesson_order=1,
            text="Test note",
            images=["data:image/jpeg;base64,test"],
            attachments=[{"name": "doc.pdf", "type": "pdf", "url": "/url"}],
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        self.assertEqual(read_schema.text, "Test note")
        self.assertEqual(read_schema.images, ["data:image/jpeg;base64,test"])
        self.assertEqual(len(read_schema.attachments), 1)

if __name__ == "__main__":
    unittest.main()
