"""Add users.token_version so logout and password resets revoke existing tokens

Revision ID: 0003_token_version
Revises: 0002_certificate_files
Create Date: 2026-10-08
"""
import sqlalchemy as sa
from alembic import op

revision = "0003_token_version"
down_revision = "0002_certificate_files"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "token_version")
