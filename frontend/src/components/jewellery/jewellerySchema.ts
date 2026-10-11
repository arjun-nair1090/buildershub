import { z } from "@/lib/zod";
import {
  GOLD_COLOURS,
  JEWELLERY_TYPES,
  PURITIES,
  STOCK_STATUSES,
  VERIFICATION_LEVELS,
  type DiscountType,
  type Jewellery,
  type JewelleryInput,
  type PricePreviewInput,
} from "@/types";
import { sumMoney } from "@/utils/format";

const weight = z
  .string()
  .trim()
  .min(1, "Enter a weight")
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number with up to 3 decimals, e.g. 15.42")
  .refine((v) => Number(v) > 0, "Weight must be more than 0");

const money = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .regex(/^\d+(\.\d{1,2})?$/, "Use a number with up to 2 decimals, without commas");

const optionalMoney = z
  .string()
  .trim()
  .regex(/^(\d+(\.\d{1,2})?)?$/, "Use a number with up to 2 decimals, without commas");

const optionalPercent = z
  .string()
  .trim()
  .regex(/^(\d{1,3}(\.\d{1,2})?)?$/, "Use a percentage with up to 2 decimals, e.g. 12.5")
  .refine((v) => !v || Number(v) <= 100, "Must be 100% or less");

const today = () => new Date().toISOString().slice(0, 10);

export const jewellerySchema = z
  .object({
    store: z.string().min(1, "Choose the store"),
    title: z.string().trim().min(2, "Give the piece a short title").max(120, "Keep it under 120 characters"),
    type: z.enum(JEWELLERY_TYPES, { message: "Choose a category" }),
    description: z.string().trim().min(3, "Describe the piece in a few words").max(500, "Keep it under 500 characters"),
    colour: z.union([z.enum(GOLD_COLOURS), z.literal("")]),
    design_details: z.string().trim().max(1000, "Keep it under 1000 characters"),
    purity: z.enum(PURITIES, { message: "Choose the purity" }),
    gross_weight: weight,
    net_weight: weight,
    verification_level: z.enum(VERIFICATION_LEVELS),
    huid: z.string().trim().regex(/^([A-Za-z0-9]{6})?$/, "A HUID is 6 letters or digits"),
    certificate_id: z
      .string()
      .trim()
      .max(64, "Keep it under 64 characters")
      .regex(/^([A-Za-z0-9][A-Za-z0-9\-/._]*)?$/, "Use letters, numbers, - / . or _"),
    issuing_authority: z.string().trim().max(160, "Keep it under 160 characters"),
    certificate_date: z.string().refine((v) => !v || v <= today(), "Date can't be in the future"),
    gold_value: money("gold value"),
    making_charges: money("making charges"),
    other_component_value: optionalMoney,
    tax: money("tax"),
    manual_total: z.boolean(),
    total_price: optionalMoney,
    making_percent_min: optionalPercent,
    making_percent_max: optionalPercent,
    stock_status: z.enum(STOCK_STATUSES),
    is_published: z.boolean(),
    discount_type: z.enum(["", "percent", "flat"]),
    discount_value: optionalMoney,
    discount_ends_on: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (Number(v.net_weight) > Number(v.gross_weight)) issue("net_weight", "Net gold weight can't exceed gross weight");
    if (!v.certificate_id && (v.issuing_authority || v.certificate_date)) issue("certificate_id", "Add the certificate ID for these details");
    if (Boolean(v.making_percent_min) !== Boolean(v.making_percent_max)) {
      issue(v.making_percent_min ? "making_percent_max" : "making_percent_min", "Enter both ends of the range, or neither");
    } else if (v.making_percent_min && Number(v.making_percent_min) > Number(v.making_percent_max)) {
      issue("making_percent_max", "Can't be below the minimum");
    }
    if (v.manual_total && !v.total_price) issue("total_price", "Enter the corrected total");
    if (v.verification_level === "hallmark" && !v.huid) issue("huid", "Enter the piece's 6-character HUID");
    if (v.verification_level === "lab" && !(v.certificate_id && v.issuing_authority && v.certificate_date)) {
      issue("verification_level", "Lab verified needs the certificate ID, issuing authority and date");
    }
    if (v.discount_type) {
      const value = Number(v.discount_value);
      const registered = v.manual_total && v.total_price ? Number(v.total_price) : sumMoney(v.gold_value, v.making_charges, v.other_component_value, v.tax);
      if (!v.discount_value) issue("discount_value", "Enter the discount");
      else if (v.discount_type === "percent" && (value < 1 || value > 90)) issue("discount_value", "Between 1 and 90");
      else if (v.discount_type === "flat" && (value <= 0 || value >= registered)) issue("discount_value", "Must be above ₹0 and below the registered price");
    }
  });

export type JewelleryFormValues = z.infer<typeof jewellerySchema>;

export const emptyValues: JewelleryFormValues = {
  store: "",
  title: "",
  type: "" as JewelleryFormValues["type"],
  description: "",
  colour: "",
  design_details: "",
  purity: "22K",
  gross_weight: "",
  net_weight: "",
  verification_level: "declared",
  huid: "",
  certificate_id: "",
  issuing_authority: "",
  certificate_date: "",
  gold_value: "",
  making_charges: "",
  other_component_value: "",
  tax: "",
  manual_total: false,
  total_price: "",
  making_percent_min: "",
  making_percent_max: "",
  stock_status: "in_stock",
  is_published: false,
  discount_type: "",
  discount_value: "",
  discount_ends_on: "",
};

/** Strip API decimals like "98500.00" to "98500" for editing. */
const plain = (v: string) => String(Number(v));

export function toFormValues(item: Jewellery): JewelleryFormValues {
  const calculated = sumMoney(item.gold_value, item.making_charges, item.other_component_value, item.tax);
  const manual = Math.abs(calculated - Number(item.total_price)) >= 0.01;
  return {
    store: item.store.slug,
    title: item.title,
    type: item.type,
    description: item.description,
    colour: item.colour ?? "",
    design_details: item.design_details ?? "",
    purity: item.purity,
    gross_weight: plain(item.gross_weight),
    net_weight: plain(item.net_weight),
    verification_level: item.verification_level,
    huid: item.huid ?? "",
    certificate_id: item.certificate_id ?? "",
    issuing_authority: item.issuing_authority ?? "",
    certificate_date: item.certificate_date ?? "",
    gold_value: plain(item.gold_value),
    making_charges: plain(item.making_charges),
    other_component_value: plain(item.other_component_value),
    tax: plain(item.tax),
    manual_total: manual,
    total_price: manual ? plain(item.total_price) : "",
    making_percent_min: item.making_percent_min === null ? "" : plain(item.making_percent_min),
    making_percent_max: item.making_percent_max === null ? "" : plain(item.making_percent_max),
    stock_status: item.stock_status,
    is_published: item.is_published,
    discount_type: item.discount_type ?? "",
    discount_value: item.discount_value === null ? "" : plain(item.discount_value),
    discount_ends_on: item.discount_ends_on ?? "",
  };
}

export function toInput(v: JewelleryFormValues): JewelleryInput {
  const discounted = Boolean(v.discount_type);
  return {
    store: v.store,
    title: v.title,
    type: v.type,
    description: v.description,
    colour: v.colour || null,
    design_details: v.design_details || null,
    purity: v.purity,
    gross_weight: v.gross_weight,
    net_weight: v.net_weight,
    verification_level: v.verification_level,
    huid: v.huid ? v.huid.toUpperCase() : null,
    certificate_id: v.certificate_id || null,
    issuing_authority: v.issuing_authority || null,
    certificate_date: v.certificate_date || null,
    gold_value: v.gold_value,
    making_charges: v.making_charges,
    other_component_value: v.other_component_value || "0",
    tax: v.tax,
    total_price: v.manual_total ? v.total_price : null,
    making_percent_min: v.making_percent_min || null,
    making_percent_max: v.making_percent_max || null,
    stock_status: v.stock_status,
    is_published: v.is_published,
    discount_type: discounted ? (v.discount_type as DiscountType) : null,
    discount_value: discounted ? v.discount_value : null,
    discount_ends_on: discounted && v.discount_ends_on ? v.discount_ends_on : null,
  };
}

const isNumber = (s: string | undefined) => /^\d+(\.\d+)?$/.test((s ?? "").trim());

/** The figures for a price preview, or null while the form doesn't have enough to price the piece. */
export function toPreviewInput(v: JewelleryFormValues): PricePreviewInput | null {
  if (![v.net_weight, v.gold_value, v.making_charges, v.tax].every(isNumber) || Number(v.net_weight) <= 0) return null;
  if (v.other_component_value && !isNumber(v.other_component_value)) return null;
  const ranged = isNumber(v.making_percent_min) && isNumber(v.making_percent_max);
  const discounted = Boolean(v.discount_type) && isNumber(v.discount_value);
  return {
    purity: v.purity,
    net_weight: v.net_weight.trim(),
    gold_value: v.gold_value.trim(),
    making_charges: v.making_charges.trim(),
    other_component_value: v.other_component_value.trim() || "0",
    tax: v.tax.trim(),
    making_percent_min: ranged ? v.making_percent_min.trim() : null,
    making_percent_max: ranged ? v.making_percent_max.trim() : null,
    discount_type: discounted ? (v.discount_type as DiscountType) : null,
    discount_value: discounted ? v.discount_value.trim() : null,
    discount_ends_on: discounted && v.discount_ends_on ? v.discount_ends_on : null,
    stock_status: v.stock_status,
  };
}
