"""Initial migration

Revision ID: 001_initial
Revises: 
Create Date: 2026-09-05 19:23:38.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('subjects',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('short_name', sa.String(length=10), nullable=False),
    sa.Column('color_hex', sa.String(length=7), nullable=False),
    sa.Column('default_cabinet', sa.String(length=20), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('homeworks',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('subject_id', sa.UUID(), nullable=False),
    sa.Column('due_date', sa.Date(), nullable=False),
    sa.Column('lesson_order', sa.SmallInteger(), nullable=True),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('is_completed', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_homeworks_due_date'), 'homeworks', ['due_date'], unique=False)
    op.create_table('schedule_rules',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('subject_id', sa.UUID(), nullable=False),
    sa.Column('day_of_week', sa.SmallInteger(), nullable=False),
    sa.Column('week_type', sa.Enum('all', 'numerator', 'denominator', name='weektype'), nullable=False),
    sa.Column('lesson_order', sa.SmallInteger(), nullable=False),
    sa.Column('start_time', sa.Time(), nullable=False),
    sa.Column('end_time', sa.Time(), nullable=False),
    sa.Column('cabinet', sa.String(length=20), nullable=True),
    sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('day_of_week', 'week_type', 'lesson_order', name='uq_schedule_rule_day_week_order')
    )


def downgrade() -> None:
    op.drop_table('schedule_rules')
    op.drop_index(op.f('ix_homeworks_due_date'), table_name='homeworks')
    op.drop_table('homeworks')
    op.drop_table('subjects')
    op.execute("DROP TYPE weektype;")
