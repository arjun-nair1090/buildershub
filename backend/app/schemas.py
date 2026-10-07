from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.constants import JEWELLERY_TYPES, PURITY_PERCENT

JewelleryType = Literal[JEWELLERY_TYPES]  # type: ignore[valid-type]
Purity = Literal[tuple(PURITY_PERCENT)]  # type: ignore[valid-type]
RecordStatus = Literal["active", "inactive"]

Weight = Annotated[Decimal, Field(gt=0, le=100000, max_digits=10, decimal_places=3)]
Money = Annotated[Decimal, Field(ge=0, le=999999999, max_digits=12, decimal_places=2)]


# ---------- Auth ----------

class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    email: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


# ---------- Jewellery ----------

class JewelleryIn(BaseModel):
    type: JewelleryType
    description: str = Field(min_length=3, max_length=500)

    purity: Purity
    gross_weight: Weight
    net_weight: Weight

    certificate_id: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9\-/._]*$")
    issuing_authority: str | None = Field(default=None, max_length=160)
    certificate_date: date | None = None

    gold_value: Money
    making_charges: Money
    other_component_value: Money = Decimal("0")
    tax: Money
    # Optional manual correction. When omitted the total is calculated from the components.
    total_price: Money | None = None

    @field_validator("description", "certificate_id", "issuing_authority", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @model_validator(mode="after")
    def check_consistency(self):
        if self.net_weight > self.gross_weight:
            raise ValueError("Net gold weight cannot exceed gross weight")
        if self.certificate_date and self.certificate_date > date.today():
            raise ValueError("Certificate date cannot be in the future")
        if (self.issuing_authority or self.certificate_date) and not self.certificate_id:
            raise ValueError("Certificate ID is required when certificate details are provided")
        return self

    @property
    def calculated_total(self) -> Decimal:
        return self.gold_value + self.making_charges + self.other_component_value + self.tax


class JewelleryUpdate(JewelleryIn):
    status: RecordStatus | None = None


class JewelleryOut(BaseModel):
    """Admin view. Deliberately excludes the internal database id."""

    model_config = ConfigDict(from_attributes=True)

    jewellery_id: str
    verification_token: str
    verification_url: str
    type: str
    description: str
    purity: str
    purity_percent: str
    gross_weight: Decimal
    net_weight: Decimal
    certificate_id: str | None
    issuing_authority: str | None
    certificate_date: date | None
    has_certificate_document: bool
    gold_value: Decimal
    making_charges: Decimal
    other_component_value: Decimal
    tax: Decimal
    total_price: Decimal
    status: str
    verification_status: str
    created_at: datetime
    updated_at: datetime


class JewelleryPage(BaseModel):
    items: list[JewelleryOut]
    total: int
    page: int
    page_size: int


class JewelleryStats(BaseModel):
    total: int
    active: int
    verified: int
    inactive: int


# ---------- Public verification ----------

class PublicVerification(BaseModel):
    """Everything a buyer sees. No internal ids, no document paths, no admin data."""

    jewellery_id: str
    type: str
    description: str
    purity: str
    purity_percent: str
    gross_weight: Decimal
    net_weight: Decimal
    certificate_id: str | None
    issuing_authority: str | None
    certificate_date: date | None
    gold_value: Decimal
    making_charges: Decimal
    other_component_value: Decimal
    tax: Decimal
    total_price: Decimal
    verification_status: str
    record_status: str
    registered_on: date
