"""homework assigned date

Revision ID: 011_homework_assigned_date
Revises: 010_lesson_notes_attachments
Create Date: 2024-05-18 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '011_homework_assigned_date'
down_revision: Union[str, None] = '010_lesson_notes_attachments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add assigned_date and created_at columns to homeworks
    op.add_column('homeworks', sa.Column('assigned_date', sa.Date(), nullable=True))
    op.add_column('homeworks', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False))

def downgrade() -> None:
    # Remove columns
    op.drop_column('homeworks', 'created_at')
    op.drop_column('homeworks', 'assigned_date')
