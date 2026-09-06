"""Add images column to homeworks table

Revision ID: 004_homework_images
Revises: 003_expand_subject_short_name
Create Date: 2026-09-06 14:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_homework_images'
down_revision: Union[str, None] = '003_expand_subject_short_name'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'homeworks',
        sa.Column('images', sa.JSON(), nullable=True, server_default='[]')
    )


def downgrade() -> None:
    op.drop_column('homeworks', 'images')
