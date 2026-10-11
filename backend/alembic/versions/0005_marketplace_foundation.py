"""Stores, designs and photos; verification levels, stock, publishing and discounts on pieces

Revision ID: 0005_marketplace_foundation
Revises: 0004_store_and_live_pricing
Create Date: 2026-10-11
"""
import re
import secrets
import uuid
from datetime import datetime, timezone
from io import BytesIO

import sqlalchemy as sa
from alembic import op
from PIL import Image

revision = "0005_marketplace_foundation"
down_revision = "0004_store_and_live_pricing"
branch_labels = None
depends_on = None

# Existing pieces move onto one store with these details until the team edits them in admin.
PLACEHOLDER = {
    "address": "Placeholder address, Zaveri Bazaar, Mumbai",
    "area": "Zaveri Bazaar",
    "city": "Mumbai",
    "latitude": 18.9517,
    "longitude": 72.8331,
    "hours": "Placeholder: Mon-Sat 11 am - 8 pm",
}
ONE_OWNER = (
    "(CASE WHEN store_id IS NULL THEN 0 ELSE 1 END)"
    " + (CASE WHEN piece_id IS NULL THEN 0 ELSE 1 END)"
    " + (CASE WHEN design_id IS NULL THEN 0 ELSE 1 END) = 1"
)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80] or "store"


def _jpeg(data: bytes, px: int) -> tuple[bytes, int, int]:
    """Same output as app.services.photos, inlined so the migration doesn't depend on app code."""
    img = Image.open(BytesIO(data)).convert("RGB")
    img.thumbnail((px, px), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
    return buf.getvalue(), img.width, img.height


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "stores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("area", sa.String(80), nullable=False),
        sa.Column("city", sa.String(80), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("whatsapp", sa.String(20), nullable=True),
        sa.Column("hours", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_stores_slug", "stores", ["slug"], unique=True)
    op.create_index("ix_stores_city", "stores", ["city"])

    op.create_table(
        "designs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(12), nullable=False),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("purity_options", sa.String(40), nullable=False),
        sa.Column("weight_min", sa.Numeric(10, 3), nullable=False),
        sa.Column("weight_max", sa.Numeric(10, 3), nullable=False),
        sa.Column("price_min", sa.Numeric(12, 2), nullable=False),
        sa.Column("price_max", sa.Numeric(12, 2), nullable=False),
        sa.Column("making_days_min", sa.Integer(), nullable=False),
        sa.Column("making_days_max", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_designs_public_id", "designs", ["public_id"], unique=True)
    op.create_index("ix_designs_store_id", "designs", ["store_id"])
    op.create_index("ix_designs_is_published", "designs", ["is_published"])

    op.create_table(
        "photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(32), nullable=False),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=True),
        sa.Column("piece_id", sa.Integer(), sa.ForeignKey("jewellery.id", ondelete="CASCADE"), nullable=True),
        sa.Column("design_id", sa.Integer(), sa.ForeignKey("designs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("alt_text", sa.String(200), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=False),
        sa.Column("thumbnail", sa.LargeBinary(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(ONE_OWNER, name="ck_photos_one_owner"),
    )
    op.create_index("ix_photos_public_id", "photos", ["public_id"], unique=True)
    op.create_index("ix_photos_store_id", "photos", ["store_id"])
    op.create_index("ix_photos_piece_id", "photos", ["piece_id"])
    op.create_index("ix_photos_design_id", "photos", ["design_id"])

    with op.batch_alter_table("jewellery") as batch:
        batch.add_column(sa.Column("store_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("title", sa.String(120), nullable=True))
        batch.add_column(sa.Column("verification_level", sa.String(20), nullable=False, server_default="declared"))
        batch.add_column(sa.Column("huid", sa.String(6), nullable=True))
        batch.add_column(sa.Column("stock_status", sa.String(20), nullable=False, server_default="in_stock"))
        batch.add_column(sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("discount_type", sa.String(10), nullable=True))
        batch.add_column(sa.Column("discount_value", sa.Numeric(12, 2), nullable=True))
        batch.add_column(sa.Column("discount_ends_on", sa.Date(), nullable=True))

    conn = op.get_bind()
    pieces = conn.execute(sa.text("SELECT id, type, description, certificate_id, photo FROM jewellery")).all()
    if pieces:
        now = datetime.now(timezone.utc)
        name = conn.execute(sa.text("SELECT store_name FROM store_settings WHERE id = 1")).scalar() or "Your Store Name"
        conn.execute(
            sa.text(
                "INSERT INTO stores (slug, name, address, area, city, latitude, longitude, hours, status,"
                " created_at, updated_at) VALUES (:slug, :name, :address, :area, :city, :latitude, :longitude,"
                " :hours, 'active', :now, :now)"
            ),
            {"slug": _slug(name), "name": name, "now": now, **PLACEHOLDER},
        )
        store_id = conn.execute(sa.text("SELECT id FROM stores")).scalar_one()
        for piece in pieces:
            # "Nakshi kada in 22K gold" -> "Nakshi kada"; without " in ", the category.
            title = piece.description.split(" in ")[0].strip() if " in " in piece.description else piece.type
            conn.execute(
                sa.text(
                    "UPDATE jewellery SET store_id = :store, title = :title, verification_level = :level,"
                    " is_published = :published WHERE id = :id"
                ),
                # Every existing piece stays published, so no printed QR code starts saying "not found".
                {"store": store_id, "title": title[:120], "level": "lab" if piece.certificate_id else "declared",
                 "published": True, "id": piece.id},
            )
            if piece.photo:
                data = conn.execute(
                    sa.text("SELECT data FROM certificate_files WHERE name = :n"), {"n": piece.photo}
                ).scalar()
                if data:
                    image, width, height = _jpeg(data, 1600)
                    thumbnail, _, _ = _jpeg(data, 600)
                    conn.execute(
                        sa.text(
                            "INSERT INTO photos (public_id, piece_id, position, alt_text, image, thumbnail, width,"
                            " height, created_at) VALUES (:pid, :piece, 0, '', :image, :thumbnail, :width, :height,"
                            " :now)"
                        ),
                        {"pid": secrets.token_hex(16), "piece": piece.id, "image": image, "thumbnail": thumbnail,
                         "width": width, "height": height, "now": now},
                    )
                    conn.execute(sa.text("DELETE FROM certificate_files WHERE name = :n"), {"n": piece.photo})

    with op.batch_alter_table("jewellery") as batch:
        batch.alter_column("store_id", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("title", existing_type=sa.String(120), nullable=False)
        batch.create_foreign_key("fk_jewellery_store_id", "stores", ["store_id"], ["id"])
        batch.create_index("ix_jewellery_store_id", ["store_id"])
        batch.create_index("ix_jewellery_stock_status", ["stock_status"])
        batch.create_index("ix_jewellery_is_published", ["is_published"])
        batch.drop_column("photo")

    with op.batch_alter_table("store_settings") as batch:
        batch.drop_column("store_name")


def downgrade() -> None:
    with op.batch_alter_table("store_settings") as batch:
        batch.add_column(sa.Column("store_name", sa.String(120), nullable=False, server_default=""))
    with op.batch_alter_table("jewellery") as batch:
        batch.add_column(sa.Column("photo", sa.String(255), nullable=True))

    conn = op.get_bind()
    name = conn.execute(sa.text("SELECT name FROM stores ORDER BY id LIMIT 1")).scalar()
    if name:
        conn.execute(sa.text("UPDATE store_settings SET store_name = :n WHERE id = 1"), {"n": name})
    first_photos = conn.execute(
        sa.text("SELECT piece_id, image FROM photos WHERE piece_id IS NOT NULL AND position = 0")
    ).all()
    for row in first_photos:
        stored = f"{uuid.uuid4().hex}.jpg"
        conn.execute(sa.text("INSERT INTO certificate_files (name, data) VALUES (:n, :d)"), {"n": stored, "d": row.image})
        conn.execute(sa.text("UPDATE jewellery SET photo = :n WHERE id = :id"), {"n": stored, "id": row.piece_id})

    with op.batch_alter_table("jewellery") as batch:
        batch.drop_index("ix_jewellery_is_published")
        batch.drop_index("ix_jewellery_stock_status")
        batch.drop_index("ix_jewellery_store_id")
        batch.drop_constraint("fk_jewellery_store_id", type_="foreignkey")
        for column in ("discount_ends_on", "discount_value", "discount_type", "is_published", "stock_status",
                       "huid", "verification_level", "title", "store_id"):
            batch.drop_column(column)

    op.drop_table("photos")
    op.drop_table("designs")
    op.drop_table("stores")
