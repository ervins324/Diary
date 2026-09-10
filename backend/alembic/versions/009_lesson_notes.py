"""Add lesson_notes table

Revision ID: 009_lesson_notes
Revises: 008_homework_is_failed
Create Date: 2026-09-10 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '009_lesson_notes'
down_revision: Union[str, None] = '008_homework_is_failed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lesson_notes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('lesson_order', sa.SmallInteger(), nullable=False),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_lesson_notes_date_order', 'lesson_notes', ['date', 'lesson_order'])
    op.create_index('ix_lesson_notes_date', 'lesson_notes', ['date'])


def downgrade() -> None:
    op.drop_index('ix_lesson_notes_date', table_name='lesson_notes')
    op.drop_index('ix_lesson_notes_date_order', table_name='lesson_notes')
    op.drop_table('lesson_notes')
