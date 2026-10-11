"""Add rate_limits for login and verify throttling

Revision ID: 0006_rate_limits
Revises: 0005_marketplace_foundation
Create Date: 2026-10-11
"""
import sqlalchemy as sa
from alembic import op

revision = "0006_rate_limits"
down_revision = "0005_marketplace_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rate_limits",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("rate_limits")
