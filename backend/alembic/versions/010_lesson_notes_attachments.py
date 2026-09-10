"""Add images and attachments to lesson_notes

Revision ID: 010_lesson_notes_attachments
Revises: 009_lesson_notes
Create Date: 2026-09-10 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010_lesson_notes_attachments'
down_revision: Union[str, None] = '009_lesson_notes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('lesson_notes', sa.Column('images', sa.JSON(), nullable=True, server_default='[]'))
    op.add_column('lesson_notes', sa.Column('attachments', sa.JSON(), nullable=True, server_default='[]'))


def downgrade() -> None:
    op.drop_column('lesson_notes', 'attachments')
    op.drop_column('lesson_notes', 'images')
