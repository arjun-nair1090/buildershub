import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from app.constants import (
    DISCOUNT_TYPES,
    GOLD_COLOURS,
    JEWELLERY_TYPES,
    PURITY_PERCENT,
    STOCK_STATUSES,
    VERIFICATION_LEVELS,
)

JewelleryType = Literal[JEWELLERY_TYPES]  # type: ignore[valid-type]
Purity = Literal[tuple(PURITY_PERCENT)]  # type: ignore[valid-type]
GoldColour = Literal[GOLD_COLOURS]  # type: ignore[valid-type]
VerificationLevel = Literal[VERIFICATION_LEVELS]  # type: ignore[valid-type]
StockStatus = Literal[STOCK_STATUSES]  # type: ignore[valid-type]
DiscountType = Literal[DISCOUNT_TYPES]  # type: ignore[valid-type]
RecordStatus = Literal["active", "inactive"]

Weight = Annotated[Decimal, Field(gt=0, le=100000, max_digits=10, decimal_places=3)]
Money = Annotated[Decimal, Field(ge=0, le=999999999, max_digits=12, decimal_places=2)]
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]
Slug = Annotated[str, Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
Phone = Annotated[str, Field(pattern=r"^\+?\d{8,15}$")]
Price = Annotated[Decimal, Field(gt=0, le=999999999, max_digits=12, decimal_places=2)]
Days = Annotated[int, Field(ge=1, le=365)]


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


# ---------- Shared ----------

class StoreRef(BaseModel):
    """Which store a piece or design belongs to, as buyers see it."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    area: str
    city: str


class PhotoOut(BaseModel):
    public_id: str
    alt_text: str  # as entered; blank means "use the title"
    alt: str  # what screen readers get
    width: int
    height: int
    position: int


# ---------- Stores ----------

class StoreIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: Slug | None = None  # generated from the name when omitted
    address: str = Field(min_length=5, max_length=500)
    area: str = Field(min_length=2, max_length=80)
    city: str = Field(min_length=2, max_length=80)
    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)
    phone: Phone | None = None
    whatsapp: Phone | None = None
    hours: str = Field(min_length=2, max_length=200)

    @field_validator("name", "address", "area", "city", "hours", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("slug", mode="before")
    @classmethod
    def normalise_slug(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().lower() or None
        return v

    @field_validator("phone", "whatsapp", mode="before")
    @classmethod
    def digits_only(cls, v: object) -> object:
        """Accepts "+91 98200 00000" or "(022) 2345-6789" and stores just the digits and a leading +."""
        if isinstance(v, str):
            return re.sub(r"[\s\-().]", "", v) or None
        return v

    @field_validator("latitude", "longitude", mode="before")
    @classmethod
    def six_places(cls, v: object) -> object:
        """Pasted map coordinates often have 8+ decimals; 6 is about 10 cm."""
        try:
            return Decimal(str(v)).quantize(Decimal("0.000001"))
        except (InvalidOperation, ValueError):
            return v


class StoreOut(StoreRef):
    address: str
    latitude: Decimal
    longitude: Decimal
    phone: str | None
    whatsapp: str | None
    hours: str
    status: str
    piece_count: int
    design_count: int
    photos: list[PhotoOut]
    created_at: datetime
    updated_at: datetime


# ---------- Designs ----------

class DesignIn(BaseModel):
    store: Slug
    title: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    category: JewelleryType
    purity_options: list[Purity] = Field(min_length=1, max_length=4)
    weight_min: Weight
    weight_max: Weight
    price_min: Price
    price_max: Price
    making_days_min: Days
    making_days_max: Days
    is_published: bool = False

    @field_validator("store", "title", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("description", mode="before")
    @classmethod
    def blank_to_none(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip() or None
        return v

    @field_validator("purity_options")
    @classmethod
    def in_karat_order(cls, purities: list[str]) -> list[str]:
        return [p for p in PURITY_PERCENT if p in purities]  # also drops duplicates

    @field_validator("weight_max", "price_max", "making_days_max")
    @classmethod
    def max_not_below_min(cls, value, info: ValidationInfo):
        low = info.data.get(info.field_name.replace("_max", "_min"))
        if low is not None and value < low:
            raise ValueError("Can't be below the minimum")
        return value


class DesignOut(BaseModel):
    public_id: str
    store: StoreRef
    title: str
    description: str | None
    category: str
    purity_options: list[str]
    weight_min: Decimal
    weight_max: Decimal
    price_min: Decimal
    price_max: Decimal
    making_days_min: int
    making_days_max: int
    is_published: bool
    photos: list[PhotoOut]
    created_at: datetime
    updated_at: datetime


# ---------- Jewellery ----------

class JewelleryIn(BaseModel):
    store: Slug
    title: str = Field(min_length=2, max_length=120)
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
    # Declared after the certificate fields so its validator can see them.
    verification_level: VerificationLevel = Field(default="declared", validate_default=True)
    huid: str | None = Field(default=None, validate_default=True)

    gold_value: Money
    making_charges: Money
    other_component_value: Money = Decimal("0")
    tax: Money
    # Optional manual correction. When omitted the total is calculated from the components.
    total_price: Money | None = None
    # Making charges range shown to buyers, in % of the live gold value. Both or neither.
    making_percent_min: Percent | None = None
    making_percent_max: Percent | None = None

    stock_status: StockStatus = "in_stock"
    is_published: bool = False
    # Declared after the prices so a flat discount can be checked against the registered total.
    discount_type: DiscountType | None = None
    discount_value: Money | None = Field(default=None, validate_default=True)
    discount_ends_on: date | None = None

    @field_validator("description", "design_details", "certificate_id", "issuing_authority", "huid", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("store", "title", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v

    @field_validator("verification_level")
    @classmethod
    def lab_needs_certificate(cls, level: str, info: ValidationInfo) -> str:
        needed = ("certificate_id", "issuing_authority", "certificate_date")
        if level == "lab" and not all(info.data.get(k) for k in needed):
            raise ValueError("Lab verified needs the certificate ID, issuing authority and date")
        return level

    @field_validator("huid")
    @classmethod
    def huid_for_hallmark(cls, huid: str | None, info: ValidationInfo) -> str | None:
        if huid is not None and not re.fullmatch(r"[A-Za-z0-9]{6}", huid):
            raise ValueError("A HUID is 6 letters or digits")
        if huid is None and info.data.get("verification_level") == "hallmark":
            raise ValueError("Enter the piece's 6-character HUID")
        return huid.upper() if huid else None

    @field_validator("discount_value")
    @classmethod
    def discount_rules(cls, value: Decimal | None, info: ValidationInfo) -> Decimal | None:
        kind = info.data.get("discount_type")
        if kind is None:
            if value is not None:
                raise ValueError("Choose whether the discount is a percent or a flat amount")
            return None
        if value is None:
            raise ValueError("Enter the discount")
        if kind == "percent" and not Decimal(1) <= value <= Decimal(90):
            raise ValueError("A percent discount must be between 1 and 90")
        if kind == "flat":
            parts = ("gold_value", "making_charges", "other_component_value", "tax")
            total = info.data.get("total_price") or sum((info.data.get(k) or Decimal(0)) for k in parts)
            if not Decimal(0) < value < total:
                raise ValueError("A flat discount must be above ₹0 and below the registered price")
        return value

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
    """Admin view. Deliberately excludes the internal database ids."""

    model_config = ConfigDict(from_attributes=True)

    jewellery_id: str
    verification_token: str
    verification_url: str
    store: StoreRef
    title: str
    type: str
    description: str
    colour: str | None
    design_details: str | None
    photos: list[PhotoOut]
    purity: str
    purity_percent: str
    gross_weight: Decimal
    net_weight: Decimal
    verification_level: str
    huid: str | None
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
    discount_type: str | None
    discount_value: Decimal | None
    discount_ends_on: date | None
    stock_status: str
    is_published: bool
    price: "PiecePrice"  # what buyers see right now
    status: str
    created_at: datetime
    updated_at: datetime


class JewelleryStats(BaseModel):
    total: int
    published: int  # active and published
    in_stock: int  # active, published and in stock
    inactive: int
    stores: int
    designs: int


class PricePreviewIn(BaseModel):
    """The figures the admin form has so far, to preview the price buyers would see."""

    purity: Purity
    net_weight: Weight
    gold_value: Money
    making_charges: Money
    other_component_value: Money = Decimal("0")
    tax: Money
    making_percent_min: Percent | None = None
    making_percent_max: Percent | None = None
    discount_type: DiscountType | None = None
    discount_value: Money | None = None
    discount_ends_on: date | None = None
    stock_status: StockStatus = "in_stock"


class JewelleryPage(BaseModel):
    items: list[JewelleryOut]
    total: int
    page: int
    page_size: int


# ---------- Store settings & gold rate ----------

class GoldRateOut(BaseModel):
    """Market rate per gram, for each karat. `change_percent` is the move since the previous fetch."""

    per_gram: dict[str, Decimal]
    change_percent: Decimal | None
    updated_at: datetime
    source: str


class StoreSettingsIn(BaseModel):
    gst_percent: Percent


class StoreSettingsOut(StoreSettingsIn):
    gold_feed_configured: bool
    gold_rate_ttl_minutes: int
    gold_rate: GoldRateOut | None


# ---------- Public verification ----------

class PriceDiscount(BaseModel):
    type: DiscountType
    value: Decimal
    label: str  # "10% off" or "₹5,000 off"
    amount_min: Decimal
    amount_max: Decimal
    ends_on: date | None


class PiecePrice(BaseModel):
    """A piece's price right now. Every line is in whole rupees and the lines add up exactly:
    gold + making + other + tax = original; original - discount = final. min equals max when
    making charges are a single amount."""

    basis: Literal["live", "registered"]
    as_of: datetime
    rate_per_gram: Decimal | None  # for the piece's purity; None on the registered basis
    gold: Decimal
    making_min: Decimal
    making_max: Decimal
    making_percent_min: Decimal | None
    making_percent_max: Decimal | None
    other: Decimal
    gst_percent: Decimal
    tax_min: Decimal
    tax_max: Decimal
    original_min: Decimal
    original_max: Decimal
    discount: PriceDiscount | None
    final_min: Decimal
    final_max: Decimal


class PublicVerification(BaseModel):
    """Everything a buyer sees. No internal ids, no document paths, no admin data."""

    jewellery_id: str
    title: str
    store: StoreRef
    type: str
    description: str
    colour: str | None
    design_details: str | None
    photos: list[PhotoOut]
    purity: str
    purity_percent: str
    gross_weight: Decimal
    net_weight: Decimal
    verification_level: VerificationLevel
    # Only what the level vouches for: the HUID from Hallmark linked up, the certificate for Lab verified.
    huid: str | None
    certificate_id: str | None
    issuing_authority: str | None
    certificate_date: date | None
    stock_status: StockStatus
    record_status: Literal["ACTIVE"]
    registered_on: date
    gold_rate: GoldRateOut | None
    price: PiecePrice


JewelleryOut.model_rebuild()
