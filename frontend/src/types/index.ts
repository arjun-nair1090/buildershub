export const JEWELLERY_TYPES = [
  "Ring",
  "Necklace",
  "Bracelet",
  "Chain",
  "Earrings",
  "Bangle",
  "Pendant",
  "Other",
] as const;
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

export type RecordStatus = "active" | "inactive";
export type VerificationStatus = "VERIFIED" | "REGISTERED" | "INACTIVE";

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

export interface Jewellery {
  jewellery_id: string;
  verification_token: string;
  verification_url: string;
  type: JewelleryType;
  description: string;
  colour: GoldColour | null;
  design_details: string | null;
  has_photo: boolean;
  purity: Purity;
  purity_percent: string;
  gross_weight: DecimalString;
  net_weight: DecimalString;
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
  status: RecordStatus;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface JewelleryInput {
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
  gold_value: string;
  making_charges: string;
  other_component_value: string;
  tax: string;
  total_price: string | null;
  making_percent_min: string | null;
  making_percent_max: string | null;
  status?: RecordStatus;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface JewelleryStats {
  total: number;
  active: number;
  verified: number;
  inactive: number;
}

export type SortField = "created_at" | "jewellery_id" | "type" | "net_weight" | "total_price";

export interface JewelleryQuery {
  search?: string;
  type?: JewelleryType | "";
  purity?: Purity | "";
  status?: RecordStatus | "";
  sort?: SortField;
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

/** Market rate per gram for each karat. `change_percent` is the move since the previous fetch. */
export interface GoldRate {
  per_gram: Record<Purity, DecimalString>;
  change_percent: DecimalString | null;
  updated_at: string;
  source: string;
}

export interface StoreSettings {
  store_name: string;
  gst_percent: DecimalString;
  gold_feed_configured: boolean;
  gold_rate_ttl_minutes: number;
  gold_rate: GoldRate | null;
}

/** Price at the current gold rate. min equals max when the item has no making charges range. */
export interface LivePrice {
  rate_per_gram: DecimalString;
  gold_value: DecimalString;
  making_charges_min: DecimalString;
  making_charges_max: DecimalString;
  making_percent_min: DecimalString | null;
  making_percent_max: DecimalString | null;
  other_component_value: DecimalString;
  gst_percent: DecimalString;
  tax_min: DecimalString;
  tax_max: DecimalString;
  total_min: DecimalString;
  total_max: DecimalString;
}

export interface PublicVerification {
  jewellery_id: string;
  store_name: string | null;
  type: JewelleryType;
  description: string;
  colour: GoldColour | null;
  design_details: string | null;
  /** Null when there's no photo; changes when the photo is replaced. */
  photo_version: string | null;
  purity: Purity;
  purity_percent: string;
  gross_weight: DecimalString;
  net_weight: DecimalString;
  certificate_id: string | null;
  issuing_authority: string | null;
  certificate_date: string | null;
  gold_value: DecimalString;
  making_charges: DecimalString;
  other_component_value: DecimalString;
  tax: DecimalString;
  total_price: DecimalString;
  verification_status: Exclude<VerificationStatus, "INACTIVE">;
  record_status: "ACTIVE";
  registered_on: string;
  gold_rate: GoldRate | null;
  live_price: LivePrice | null;
}
