"""Store certificate documents in the database instead of on local disk

Revision ID: 0002_certificate_files
Revises: 0001_initial
Create Date: 2026-10-08
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_certificate_files"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "certificate_files",
        sa.Column("name", sa.String(64), primary_key=True),
        sa.Column("data", sa.LargeBinary(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("certificate_files")
