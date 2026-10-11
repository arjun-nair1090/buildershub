"""Store settings, live gold rates, product photo, colour, design details and making-charge ranges

Revision ID: 0004_store_and_live_pricing
Revises: 0003_token_version
Create Date: 2026-10-11
"""
import sqlalchemy as sa
from alembic import op

revision = "0004_store_and_live_pricing"
down_revision = "0003_token_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jewellery", sa.Column("colour", sa.String(30), nullable=True))
    op.add_column("jewellery", sa.Column("design_details", sa.Text(), nullable=True))
    op.add_column("jewellery", sa.Column("photo", sa.String(255), nullable=True))
    op.add_column("jewellery", sa.Column("making_percent_min", sa.Numeric(5, 2), nullable=True))
    op.add_column("jewellery", sa.Column("making_percent_max", sa.Numeric(5, 2), nullable=True))

    store = op.create_table(
        "store_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("store_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("gst_percent", sa.Numeric(5, 2), nullable=False, server_default="3.00"),
        sa.Column("gold_rate_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.bulk_insert(store, [{"id": 1, "store_name": "", "gst_percent": 3}])

    op.create_table(
        "gold_rates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inr_per_gram_24k", sa.Numeric(12, 2), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_gold_rates_fetched_at", "gold_rates", ["fetched_at"])


def downgrade() -> None:
    op.drop_index("ix_gold_rates_fetched_at", table_name="gold_rates")
    op.drop_table("gold_rates")
    op.drop_table("store_settings")
    for column in ("making_percent_max", "making_percent_min", "photo", "design_details", "colour"):
        op.drop_column("jewellery", column)
