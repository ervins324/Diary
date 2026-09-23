"""Add is_consultation column to schedule_rules

Revision ID: 013
Revises: 012
Create Date: 2026-09-23
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '013_schedule_rule_consultation'
down_revision = '012_holidays'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('schedule_rules', sa.Column('is_consultation', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('schedule_rules', 'is_consultation')
