"""Add time_spent_seconds column to homeworks table

Revision ID: 007_homework_time_spent
Revises: 006_lesson_event_types
Create Date: 2026-09-08 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_homework_time_spent'
down_revision: Union[str, None] = '006_lesson_event_types'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add time_spent_seconds column for homework stopwatch timer
    op.add_column(
        'homeworks',
        sa.Column('time_spent_seconds', sa.Integer(), nullable=True, server_default='0')
    )


def downgrade() -> None:
    op.drop_column('homeworks', 'time_spent_seconds')
