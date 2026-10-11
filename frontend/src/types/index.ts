export const JEWELLERY_TYPES = ["Ring", "Necklace", "Bracelet", "Chain", "Earrings", "Bangle", "Pendant", "Other"] as const;
export type JewelleryType = (typeof JEWELLERY_TYPES)[number];

export const PURITIES = ["24K", "22K", "18K", "14K"] as const;
export type Purity = (typeof PURITIES)[number];

export const PURITY_PERCENT: Record<Purity, string> = {
  "24K": "99.9",
  "22K": "91.6",
  "18K": "75.0",
  "14K": "58.5",
};

export const GOLD_COLOURS = ["Yellow gold", "Rose gold", "White gold", "Two-tone", "Multi-tone"] as const;
export type GoldColour = (typeof GOLD_COLOURS)[number];

/** How far the store vouches for a piece. The badge buyers see always matches it. */
export const VERIFICATION_LEVELS = ["declared", "hallmark", "lab"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];
export const VERIFICATION_LABEL: Record<VerificationLevel, string> = {
  declared: "Declared by store",
  hallmark: "Hallmark linked",
  lab: "Lab verified",
};

export const STOCK_STATUSES = ["in_stock", "reserved", "sold"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];
export const STOCK_LABEL: Record<StockStatus, string> = { in_stock: "In stock", reserved: "Reserved", sold: "Sold" };

export type DiscountType = "percent" | "flat";
export type RecordStatus = "active" | "inactive";

export interface User {
  name: string;
  email: string;
  role: string;
}

export interface AdminUser extends User {
  status: string;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

/** Decimal values arrive from the API as strings to keep exact precision. */
export type DecimalString = string;

export interface Photo {
  public_id: string;
  /** As entered; blank means "use the title". */
  alt_text: string;
  /** What screen readers get. */
  alt: string;
  width: number;
  height: number;
  position: number;
}

export type PhotoOwner = "stores" | "jewellery" | "designs";

export interface StoreRef {
  slug: string;
  name: string;
  area: string;
  city: string;
}

export interface Store extends StoreRef {
  address: string;
  latitude: DecimalString;
  longitude: DecimalString;
  phone: string | null;
  whatsapp: string | null;
  hours: string;
  status: RecordStatus;
  piece_count: number;
  design_count: number;
  photos: Photo[];
  created_at: string;
  updated_at: string;
}

export interface StoreInput {
  name: string;
  slug: string | null;
  address: string;
  area: string;
  city: string;
  latitude: string;
  longitude: string;
  phone: string | null;
  whatsapp: string | null;
  hours: string;
}

export interface PriceDiscount {
  type: DiscountType;
  value: DecimalString;
  /** "10% off" or "₹5,000 off" */
  label: string;
  amount_min: DecimalString;
  amount_max: DecimalString;
  ends_on: string | null;
}

/** A piece's price right now, in whole rupees. gold + making + other + tax = original; original − discount = final. */
export interface PiecePrice {
  basis: "live" | "registered";
  as_of: string;
  rate_per_gram: DecimalString | null;
  gold: DecimalString;
  making_min: DecimalString;
  making_max: DecimalString;
  making_percent_min: DecimalString | null;
  making_percent_max: DecimalString | null;
  other: DecimalString;
  gst_percent: DecimalString;
  tax_min: DecimalString;
  tax_max: DecimalString;
  original_min: DecimalString;
  original_max: DecimalString;
  discount: PriceDiscount | null;
  final_min: DecimalString;
  final_max: DecimalString;
}

export interface Jewellery {
  jewellery_id: string;
  verification_token: string;
  verification_url: string;
  store: StoreRef;
  title: string;
  type: JewelleryType;
  description: string;
  colour: GoldColour | null;
  design_details: string | null;
  photos: Photo[];
  purity: Purity;
  purity_percent: string;
  gross_weight: DecimalString;
  net_weight: DecimalString;
  verification_level: VerificationLevel;
  huid: string | null;
  certificate_id: string | null;
  issuing_authority: string | null;
  certificate_date: string | null;
  has_certificate_document: boolean;
  gold_value: DecimalString;
  making_charges: DecimalString;
  other_component_value: DecimalString;
  tax: DecimalString;
  total_price: DecimalString;
  making_percent_min: DecimalString | null;
  making_percent_max: DecimalString | null;
  discount_type: DiscountType | null;
  discount_value: DecimalString | null;
  discount_ends_on: string | null;
  stock_status: StockStatus;
  is_published: boolean;
  price: PiecePrice;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface JewelleryInput {
  store: string;
  title: string;
  type: JewelleryType;
  description: string;
  colour: GoldColour | null;
  design_details: string | null;
  purity: Purity;
  gross_weight: string;
  net_weight: string;
  certificate_id: string | null;
  issuing_authority: string | null;
  certificate_date: string | null;
  verification_level: VerificationLevel;
  huid: string | null;
  gold_value: string;
  making_charges: string;
  other_component_value: string;
  tax: string;
  total_price: string | null;
  making_percent_min: string | null;
  making_percent_max: string | null;
  stock_status: StockStatus;
  is_published: boolean;
  discount_type: DiscountType | null;
  discount_value: string | null;
  discount_ends_on: string | null;
  status?: RecordStatus;
}

export type PricePreviewInput = Pick<
  JewelleryInput,
  | "purity"
  | "net_weight"
  | "gold_value"
  | "making_charges"
  | "other_component_value"
  | "tax"
  | "making_percent_min"
  | "making_percent_max"
  | "discount_type"
  | "discount_value"
  | "discount_ends_on"
  | "stock_status"
>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface JewelleryStats {
  total: number;
  published: number;
  in_stock: number;
  inactive: number;
  stores: number;
  designs: number;
}

export type SortField = "created_at" | "jewellery_id" | "type" | "net_weight" | "total_price";

export interface JewelleryQuery {
  search?: string;
  type?: JewelleryType | "";
  purity?: Purity | "";
  status?: RecordStatus | "";
  store?: string;
  published?: "true" | "false" | "";
  stock?: StockStatus | "";
  sort?: SortField;
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface Design {
  public_id: string;
  store: StoreRef;
  title: string;
  description: string | null;
  category: JewelleryType;
  purity_options: Purity[];
  weight_min: DecimalString;
  weight_max: DecimalString;
  price_min: DecimalString;
  price_max: DecimalString;
  making_days_min: number;
  making_days_max: number;
  is_published: boolean;
  photos: Photo[];
  created_at: string;
  updated_at: string;
}

export interface DesignInput {
  store: string;
  title: string;
  description: string | null;
  category: JewelleryType;
  purity_options: Purity[];
  weight_min: string;
  weight_max: string;
  price_min: string;
  price_max: string;
  making_days_min: number;
  making_days_max: number;
  is_published: boolean;
}

/** Market rate per gram for each karat. `change_percent` is the move since the previous fetch. */
export interface GoldRate {
  per_gram: Record<Purity, DecimalString>;
  change_percent: DecimalString | null;
  updated_at: string;
  source: string;
}

export interface StoreSettings {
  gst_percent: DecimalString;
  gold_feed_configured: boolean;
  gold_rate_ttl_minutes: number;
  gold_rate: GoldRate | null;
}

export interface PublicVerification {
  jewellery_id: string;
  title: string;
  store: StoreRef;
  type: JewelleryType;
  description: string;
  colour: GoldColour | null;
  design_details: string | null;
  photos: Photo[];
  purity: Purity;
  purity_percent: string;
  gross_weight: DecimalString;
  net_weight: DecimalString;
  verification_level: VerificationLevel;
  /** Only what the level vouches for: HUID from Hallmark linked up, certificate for Lab verified. */
  huid: string | null;
  certificate_id: string | null;
  issuing_authority: string | null;
  certificate_date: string | null;
  stock_status: StockStatus;
  record_status: "ACTIVE";
  registered_on: string;
  gold_rate: GoldRate | null;
  price: PiecePrice;
}
