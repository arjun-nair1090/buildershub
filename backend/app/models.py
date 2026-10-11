from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="admin")
    status: Mapped[str] = mapped_column(String(20), default="active")
    # Embedded in every token; bumping it signs out all of this user's sessions.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Photo(Base):
    """An image of a store, piece or design, at two sizes. Bytes never change: replacing a photo
    means a new row, so its URL can be cached forever."""

    __tablename__ = "photos"
    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN store_id IS NULL THEN 0 ELSE 1 END)"
            " + (CASE WHEN piece_id IS NULL THEN 0 ELSE 1 END)"
            " + (CASE WHEN design_id IS NULL THEN 0 ELSE 1 END) = 1",
            name="ck_photos_one_owner",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    store_id: Mapped[int | None] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    piece_id: Mapped[int | None] = mapped_column(ForeignKey("jewellery.id", ondelete="CASCADE"), index=True)
    design_id: Mapped[int | None] = mapped_column(ForeignKey("designs.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    alt_text: Mapped[str] = mapped_column(String(200), default="")  # blank: use the owner's title
    # Deferred so listing photos never loads the bytes.
    image: Mapped[bytes] = deferred(mapped_column(LargeBinary))
    thumbnail: Mapped[bytes] = deferred(mapped_column(LargeBinary))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Store(Base):
    """A shop on the marketplace. While it is inactive, buyers see none of its pieces or designs."""

    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)  # public key and future URL
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(Text)
    area: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80), index=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    phone: Mapped[str | None] = mapped_column(String(20))
    whatsapp: Mapped[str | None] = mapped_column(String(20))
    hours: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    photos: Mapped[list[Photo]] = relationship(
        order_by=Photo.position, cascade="all, delete-orphan", lazy="selectin", foreign_keys=[Photo.store_id]
    )


class Jewellery(Base):
    __tablename__ = "jewellery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Public, non-sequential identifiers. The internal `id` never leaves the backend.
    jewellery_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    verification_token: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(30), index=True)  # "category" in the UI
    description: Mapped[str] = mapped_column(Text)
    colour: Mapped[str | None] = mapped_column(String(30))
    design_details: Mapped[str | None] = mapped_column(Text)

    purity: Mapped[str] = mapped_column(String(10))
    gross_weight: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    net_weight: Mapped[Decimal] = mapped_column(Numeric(10, 3))

    verification_level: Mapped[str] = mapped_column(String(20), default="declared")
    huid: Mapped[str | None] = mapped_column(String(6))  # BIS hallmark unique ID
    certificate_id: Mapped[str | None] = mapped_column(String(64), index=True)
    issuing_authority: Mapped[str | None] = mapped_column(String(160))
    certificate_date: Mapped[date | None] = mapped_column(Date)
    certificate_document: Mapped[str | None] = mapped_column(String(255))

    # The registered price: the fallback when no gold rate has ever been fetched.
    gold_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    making_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    other_component_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Making charges shown to buyers as a range, in % of the live gold value. Null: the fixed amount.
    making_percent_min: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    making_percent_max: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    discount_type: Mapped[str | None] = mapped_column(String(10))
    discount_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    # The discount applies up to the end of this day, Indian time.
    discount_ends_on: Mapped[date | None] = mapped_column(Date)

    stock_status: Mapped[str] = mapped_column(String(20), default="in_stock", index=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    store: Mapped[Store] = relationship(lazy="joined")
    photos: Mapped[list[Photo]] = relationship(
        order_by=Photo.position, cascade="all, delete-orphan", lazy="selectin", foreign_keys=[Photo.piece_id]
    )

    @property
    def is_active(self) -> bool:
        """Active itself and sold by an active store. Inactive pieces never verify."""
        return self.status == "active" and self.store.status == "active"


class Design(Base):
    """A piece the store can make to order. No QR code, verification level or discount."""

    __tablename__ = "designs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30))
    purity_options: Mapped[str] = mapped_column(String(40))  # comma-separated, e.g. "22K,18K"
    weight_min: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    weight_max: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    price_min: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price_max: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    making_days_min: Mapped[int] = mapped_column(Integer)
    making_days_max: Mapped[int] = mapped_column(Integer)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    store: Mapped[Store] = relationship(lazy="joined")
    photos: Mapped[list[Photo]] = relationship(
        order_by=Photo.position, cascade="all, delete-orphan", lazy="selectin", foreign_keys=[Photo.design_id]
    )

    @property
    def purities(self) -> list[str]:
        return [p for p in self.purity_options.split(",") if p]

    @property
    def is_visible(self) -> bool:
        return self.is_published and self.store.status == "active"


class CertificateFile(Base):
    """Uploaded certificate documents. Kept in the database because serverless hosts have no lasting disk."""

    __tablename__ = "certificate_files"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)  # random hex + extension
    data: Mapped[bytes] = mapped_column(LargeBinary)


class StoreSettings(Base):
    """Marketplace-wide settings. Always a single row with id 1."""

    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    gst_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("3.00"), server_default="3.00")
    # Last time a gold rate fetch was attempted, successful or not. Stops a failing feed being retried
    # on every page view and burning the API quota.
    gold_rate_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GoldRate(Base):
    """One row per successful market fetch. The latest row is the current rate; the one before it
    gives the ticker its up/down movement."""

    __tablename__ = "gold_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inr_per_gram_24k: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # pure gold, per gram
    source: Mapped[str] = mapped_column(String(40))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
