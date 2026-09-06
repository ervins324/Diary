"""Add bell schedule table

Revision ID: 002_bell_schedule
Revises: 001_initial
Create Date: 2026-09-06 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_bell_schedule'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'bell_schedules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('lesson_order', sa.SmallInteger(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lesson_order')
    )


def downgrade() -> None:
    op.drop_table('bell_schedules')
