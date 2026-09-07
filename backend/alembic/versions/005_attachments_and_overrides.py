"""Add attachments column, stored_files table, and schedule_overrides table

Revision ID: 005_attachments_and_overrides
Revises: 004_homework_images
Create Date: 2026-09-07 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '005_attachments_and_overrides'
down_revision: Union[str, None] = '004_homework_images'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add attachments JSON column to homeworks table
    op.add_column(
        'homeworks',
        sa.Column('attachments', sa.JSON(), nullable=True, server_default='[]')
    )

    # 2. Create stored_files table for binary file persistence in PostgreSQL
    op.create_table(
        'stored_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('file_data', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 3. Create schedule_overrides table for temporal single-week substitutions
    op.create_table(
        'schedule_overrides',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('date', sa.Date(), nullable=False, index=True),
        sa.Column('lesson_order', sa.SmallInteger(), nullable=False),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('original_subject_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('original_subject_name', sa.String(length=100), nullable=True),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('cabinet', sa.String(length=20), nullable=True),
        sa.Column('is_cancelled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('note', sa.String(length=255), nullable=True),
        sa.UniqueConstraint('date', 'lesson_order', name='uq_schedule_override_date_order'),
    )


def downgrade() -> None:
    op.drop_table('schedule_overrides')
    op.drop_table('stored_files')
    op.drop_column('homeworks', 'attachments')
