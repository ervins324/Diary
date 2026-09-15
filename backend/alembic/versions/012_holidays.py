"""holidays

Revision ID: 012_holidays
Revises: 011_homework_assigned_date
Create Date: 2024-05-18 10:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '012_holidays'
down_revision: Union[str, None] = '011_homework_assigned_date'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'holidays',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False)
    )
    op.create_index(op.f('ix_holidays_start_date'), 'holidays', ['start_date'], unique=False)
    op.create_index(op.f('ix_holidays_end_date'), 'holidays', ['end_date'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_holidays_end_date'), table_name='holidays')
    op.drop_index(op.f('ix_holidays_start_date'), table_name='holidays')
    op.drop_table('holidays')
