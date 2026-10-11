from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.constants import GOLD_COLOURS, JEWELLERY_TYPES, PURITY_PERCENT

JewelleryType = Literal[JEWELLERY_TYPES]  # type: ignore[valid-type]
Purity = Literal[tuple(PURITY_PERCENT)]  # type: ignore[valid-type]
GoldColour = Literal[GOLD_COLOURS]  # type: ignore[valid-type]
RecordStatus = Literal["active", "inactive"]

Weight = Annotated[Decimal, Field(gt=0, le=100000, max_digits=10, decimal_places=3)]
Money = Annotated[Decimal, Field(ge=0, le=999999999, max_digits=12, decimal_places=2)]
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]


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


Password = Annotated[str, Field(min_length=10, max_length=128)]


class AdminCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: Password

    @field_validator("name", "email", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower()


class PasswordReset(BaseModel):
    password: Password


class AdminOut(UserOut):
    status: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


# ---------- Jewellery ----------

class JewelleryIn(BaseModel):
    type: JewelleryType
    description: str = Field(min_length=3, max_length=500)
    colour: GoldColour | None = None
    design_details: str | None = Field(default=None, max_length=1000)

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
    # Making charges range shown to buyers, in % of the live gold value. Both or neither.
    making_percent_min: Percent | None = None
    making_percent_max: Percent | None = None

    @field_validator("description", "design_details", "certificate_id", "issuing_authority", mode="before")
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
        if (self.making_percent_min is None) != (self.making_percent_max is None):
            raise ValueError("Enter both ends of the making charges range, or neither")
        if self.making_percent_min is not None and self.making_percent_min > self.making_percent_max:
            raise ValueError("Making charges range: the minimum can't be above the maximum")
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
    colour: str | None
    design_details: str | None
    has_photo: bool
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
    making_percent_min: Decimal | None
    making_percent_max: Decimal | None
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


# ---------- Store settings & gold rate ----------

class GoldRateOut(BaseModel):
    """Market rate per gram, for each karat. `change_percent` is the move since the previous fetch."""

    per_gram: dict[str, Decimal]
    change_percent: Decimal | None
    updated_at: datetime
    source: str


class StoreSettingsIn(BaseModel):
    store_name: str = Field(max_length=120)
    gst_percent: Percent

    @field_validator("store_name", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class StoreSettingsOut(StoreSettingsIn):
    gold_feed_configured: bool
    gold_rate_ttl_minutes: int
    gold_rate: GoldRateOut | None


# ---------- Public verification ----------

class LivePrice(BaseModel):
    """Price at the current gold rate. Ranges come from the making charges range; when the item has
    no range, min and max are equal."""

    rate_per_gram: Decimal
    gold_value: Decimal
    making_charges_min: Decimal
    making_charges_max: Decimal
    making_percent_min: Decimal | None
    making_percent_max: Decimal | None
    other_component_value: Decimal
    gst_percent: Decimal
    tax_min: Decimal
    tax_max: Decimal
    total_min: Decimal
    total_max: Decimal


class PublicVerification(BaseModel):
    """Everything a buyer sees. No internal ids, no document paths, no admin data."""

    jewellery_id: str
    store_name: str | None
    type: str
    description: str
    colour: str | None
    design_details: str | None
    # Null when there is no photo. Changes when the photo is replaced, so it can bust caches.
    photo_version: str | None
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
    # Null when no market rate is available; the registered amounts above are then the price.
    gold_rate: GoldRateOut | None
    live_price: LivePrice | None
