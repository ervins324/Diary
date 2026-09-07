"""Add event_type column to schedule_overrides table

Revision ID: 006_lesson_event_types
Revises: 005_attachments_and_overrides
Create Date: 2026-09-07 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006_lesson_event_types'
down_revision: Union[str, None] = '005_attachments_and_overrides'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add event_type column for tagging Control Work, Test, Essay, Project
    op.add_column(
        'schedule_overrides',
        sa.Column('event_type', sa.String(length=50), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('schedule_overrides', 'event_type')
