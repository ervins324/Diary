"""Expand subjects short_name to 30 characters

Revision ID: 003_expand_subject_short_name
Revises: 002_bell_schedule
Create Date: 2026-09-06 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_expand_subject_short_name'
down_revision: Union[str, None] = '002_bell_schedule'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'subjects',
        'short_name',
        existing_type=sa.String(length=10),
        type_=sa.String(length=30),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'subjects',
        'short_name',
        existing_type=sa.String(length=30),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
