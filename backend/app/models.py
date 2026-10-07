from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Jewellery(Base):
    __tablename__ = "jewellery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Public, non-sequential identifiers. The internal `id` never leaves the backend.
    jewellery_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    verification_token: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    type: Mapped[str] = mapped_column(String(30), index=True)
    description: Mapped[str] = mapped_column(Text)

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
