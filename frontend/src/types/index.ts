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
  status: RecordStatus;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface JewelleryInput {
  type: JewelleryType;
  description: string;
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

export interface PublicVerification {
  jewellery_id: string;
  type: JewelleryType;
  description: string;
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
}
