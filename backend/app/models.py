from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, LargeBinary, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

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


class Jewellery(Base):
    __tablename__ = "jewellery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Public, non-sequential identifiers. The internal `id` never leaves the backend.
    jewellery_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    verification_token: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    type: Mapped[str] = mapped_column(String(30), index=True)
    description: Mapped[str] = mapped_column(Text)
    colour: Mapped[str | None] = mapped_column(String(30))
    design_details: Mapped[str | None] = mapped_column(Text)
    photo: Mapped[str | None] = mapped_column(String(255))  # stored file name, like certificate_document

    purity: Mapped[str] = mapped_column(String(10))
    gross_weight: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    net_weight: Mapped[Decimal] = mapped_column(Numeric(10, 3))

    certificate_id: Mapped[str | None] = mapped_column(String(64), index=True)
    issuing_authority: Mapped[str | None] = mapped_column(String(160))
    certificate_date: Mapped[date | None] = mapped_column(Date)
    certificate_document: Mapped[str | None] = mapped_column(String(255))

    gold_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    making_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    other_component_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Making charges shown to buyers as a range, in % of the live gold value. Null: show the fixed amount.
    making_percent_min: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    making_percent_max: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    @property
    def verification_status(self) -> str:
        """VERIFIED: active with a certificate reference. REGISTERED: active, no certificate
        reference on file. INACTIVE: deactivated, never shown as verified."""
        if self.status != "active":
            return "INACTIVE"
        return "VERIFIED" if self.certificate_id else "REGISTERED"


class CertificateFile(Base):
    """Uploaded file bytes: certificate documents and product photos. Kept in the database
    because serverless hosts have no lasting disk."""

    __tablename__ = "certificate_files"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)  # random hex + extension
    data: Mapped[bytes] = mapped_column(LargeBinary)


class StoreSettings(Base):
    """Shop-wide settings. Always a single row with id 1."""

    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_name: Mapped[str] = mapped_column(String(120), default="", server_default="")
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
