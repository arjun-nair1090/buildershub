import { z } from "zod";
import { GOLD_COLOURS, JEWELLERY_TYPES, PURITIES, type Jewellery, type JewelleryInput } from "@/types";
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
    type: z.enum(JEWELLERY_TYPES, { message: "Choose a jewellery type" }),
    description: z.string().trim().min(3, "Describe the piece in a few words").max(500, "Keep it under 500 characters"),
    colour: z.union([z.enum(GOLD_COLOURS), z.literal("")]),
    design_details: z.string().trim().max(1000, "Keep it under 1000 characters"),
    purity: z.enum(PURITIES, { message: "Choose the purity" }),
    gross_weight: weight,
    net_weight: weight,
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
  })
  .superRefine((v, ctx) => {
    if (Number(v.net_weight) > Number(v.gross_weight)) {
      ctx.addIssue({ code: "custom", path: ["net_weight"], message: "Net gold weight can't exceed gross weight" });
    }
    if (!v.certificate_id && (v.issuing_authority || v.certificate_date)) {
      ctx.addIssue({ code: "custom", path: ["certificate_id"], message: "Add the certificate ID for these details" });
    }
    if (Boolean(v.making_percent_min) !== Boolean(v.making_percent_max)) {
      const path = v.making_percent_min ? "making_percent_max" : "making_percent_min";
      ctx.addIssue({ code: "custom", path: [path], message: "Enter both ends of the range, or neither" });
    } else if (v.making_percent_min && Number(v.making_percent_min) > Number(v.making_percent_max)) {
      ctx.addIssue({ code: "custom", path: ["making_percent_max"], message: "Can't be below the minimum" });
    }
    if (v.manual_total && !v.total_price) {
      ctx.addIssue({ code: "custom", path: ["total_price"], message: "Enter the corrected total" });
    }
  });

export type JewelleryFormValues = z.infer<typeof jewellerySchema>;

export const emptyValues: JewelleryFormValues = {
  type: "" as JewelleryFormValues["type"],
  description: "",
  colour: "",
  design_details: "",
  purity: "22K",
  gross_weight: "",
  net_weight: "",
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
};

/** Strip API decimals like "98500.00" to "98500" for editing. */
const plain = (v: string) => String(Number(v));

export function toFormValues(item: Jewellery): JewelleryFormValues {
  const calculated = sumMoney(item.gold_value, item.making_charges, item.other_component_value, item.tax);
  const manual = Math.abs(calculated - Number(item.total_price)) >= 0.01;
  return {
    type: item.type,
    description: item.description,
    colour: item.colour ?? "",
    design_details: item.design_details ?? "",
    purity: item.purity,
    gross_weight: plain(item.gross_weight),
    net_weight: plain(item.net_weight),
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
  };
}

export function toInput(v: JewelleryFormValues): JewelleryInput {
  return {
    type: v.type,
    description: v.description,
    colour: v.colour || null,
    design_details: v.design_details || null,
    purity: v.purity,
    gross_weight: v.gross_weight,
    net_weight: v.net_weight,
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
  };
}
