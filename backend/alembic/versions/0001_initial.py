"""Initial schema: users and jewellery

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-07
"""
import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="admin"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "jewellery",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("jewellery_id", sa.String(20), nullable=False),
        sa.Column("verification_token", sa.String(32), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("purity", sa.String(10), nullable=False),
        sa.Column("gross_weight", sa.Numeric(10, 3), nullable=False),
        sa.Column("net_weight", sa.Numeric(10, 3), nullable=False),
        sa.Column("certificate_id", sa.String(64), nullable=True),
        sa.Column("issuing_authority", sa.String(160), nullable=True),
        sa.Column("certificate_date", sa.Date(), nullable=True),
        sa.Column("certificate_document", sa.String(255), nullable=True),
        sa.Column("gold_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("making_charges", sa.Numeric(12, 2), nullable=False),
        sa.Column("other_component_value", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tax", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("net_weight <= gross_weight", name="ck_jewellery_net_le_gross"),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="ck_jewellery_status"),
    )
    op.create_index("ix_jewellery_jewellery_id", "jewellery", ["jewellery_id"], unique=True)
    op.create_index("ix_jewellery_verification_token", "jewellery", ["verification_token"], unique=True)
    op.create_index("ix_jewellery_type", "jewellery", ["type"])
    op.create_index("ix_jewellery_certificate_id", "jewellery", ["certificate_id"])
    op.create_index("ix_jewellery_status", "jewellery", ["status"])
    op.create_index("ix_jewellery_created_at", "jewellery", ["created_at"])


def downgrade() -> None:
    op.drop_table("jewellery")
    op.drop_table("users")
