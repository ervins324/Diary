"""Add app_settings table for centralized server-side configuration

Revision ID: 014
Revises: 013
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '014_app_settings'
down_revision = '013_schedule_rule_consultation'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'app_settings',
        sa.Column('id', sa.String(length=50), nullable=False, primary_key=True),
        sa.Column('skip_weekends_to_monday', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('day_shift_after_hour', sa.Integer(), nullable=True),
        sa.Column('show_cabinets', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('live_widget_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('live_widget_show_lesson', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('live_widget_show_homework', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('live_widget_show_events', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('hw_icon_size', sa.String(length=20), nullable=False, server_default='medium'),
        sa.Column('air_alerts_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('air_alerts_region', sa.String(length=100), nullable=False, server_default='kyiv_city'),
        sa.Column('air_alerts_auto_cancel', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('default_lesson_duration', sa.Integer(), nullable=False, server_default='45'),
        sa.Column('default_break_duration', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('auto_bell_notifications', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('semester_anchor_date', sa.String(length=20), nullable=False, server_default='2026-09-01'),
        sa.Column('font_family', sa.String(length=50), nullable=False, server_default='inter'),
        sa.Column('theme', sa.String(length=20), nullable=False, server_default='dark'),
        sa.Column('language', sa.String(length=10), nullable=False, server_default='uk'),
        sa.Column('custom_event_types', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('custom_lesson_types', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('auto_clean_settings', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('app_settings')
