import { z } from "zod";
import { JEWELLERY_TYPES, PURITIES, type Design, type DesignInput } from "@/types";

const weight = z
  .string()
  .trim()
  .min(1, "Enter a weight")
  .regex(/^\d+(\.\d{1,3})?$/, "Use a number with up to 3 decimals")
  .refine((v) => Number(v) > 0, "Must be more than 0");

const price = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .regex(/^\d+(\.\d{1,2})?$/, "Use a number without commas")
  .refine((v) => Number(v) > 0, "Must be more than 0");

const days = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/, "Whole days, e.g. 14")
  .refine((v) => Number(v) >= 1 && Number(v) <= 365, "Between 1 and 365 days");

export const designSchema = z
  .object({
    store: z.string().min(1, "Choose the store"),
    title: z.string().trim().min(2, "Give the design a short title").max(120, "Keep it under 120 characters"),
    description: z.string().trim().max(1000, "Keep it under 1000 characters"),
    category: z.enum(JEWELLERY_TYPES, { message: "Choose a category" }),
    purity_options: z.array(z.enum(PURITIES)).min(1, "Choose at least one purity"),
    weight_min: weight,
    weight_max: weight,
    price_min: price,
    price_max: price,
    making_days_min: days,
    making_days_max: days,
    is_published: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const pairs = [
      ["weight_min", "weight_max"],
      ["price_min", "price_max"],
      ["making_days_min", "making_days_max"],
    ] as const;
    for (const [low, high] of pairs) {
      if (Number(v[high]) < Number(v[low])) ctx.addIssue({ code: "custom", path: [high], message: "Can't be below the minimum" });
    }
  });

export type DesignFormValues = z.infer<typeof designSchema>;

export const emptyDesign: DesignFormValues = {
  store: "",
  title: "",
  description: "",
  category: "" as DesignFormValues["category"],
  purity_options: ["22K"],
  weight_min: "",
  weight_max: "",
  price_min: "",
  price_max: "",
  making_days_min: "",
  making_days_max: "",
  is_published: false,
};

const plain = (v: string) => String(Number(v));

export function designToForm(d: Design): DesignFormValues {
  return {
    store: d.store.slug,
    title: d.title,
    description: d.description ?? "",
    category: d.category,
    purity_options: d.purity_options,
    weight_min: plain(d.weight_min),
    weight_max: plain(d.weight_max),
    price_min: plain(d.price_min),
    price_max: plain(d.price_max),
    making_days_min: String(d.making_days_min),
    making_days_max: String(d.making_days_max),
    is_published: d.is_published,
  };
}

export function designToInput(v: DesignFormValues): DesignInput {
  return {
    ...v,
    description: v.description || null,
    making_days_min: Number(v.making_days_min),
    making_days_max: Number(v.making_days_max),
  };
}
