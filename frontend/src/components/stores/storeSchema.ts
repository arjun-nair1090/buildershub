import { z } from "zod";
import type { Store, StoreInput } from "@/types";

const phone = z
  .string()
  .trim()
  .refine((v) => !v || /^\+?\d{8,15}$/.test(v.replace(/[\s\-().]/g, "")), "Use 8 to 15 digits, optionally starting with +");

const coordinate = (label: string, limit: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v) && Math.abs(Number(v)) <= limit, `A number between -${limit} and ${limit}`);

export const storeSchema = z.object({
  name: z.string().trim().min(2, "Enter the store name").max(120, "Keep it under 120 characters"),
  slug: z
    .string()
    .trim()
    .max(80, "Keep it under 80 characters")
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Lower-case letters, numbers and single hyphens"),
  address: z.string().trim().min(5, "Enter the full address").max(500, "Keep it under 500 characters"),
  area: z.string().trim().min(2, "Enter the area").max(80, "Keep it under 80 characters"),
  city: z.string().trim().min(2, "Enter the city").max(80, "Keep it under 80 characters"),
  latitude: coordinate("latitude", 90),
  longitude: coordinate("longitude", 180),
  phone,
  whatsapp: phone,
  hours: z.string().trim().min(2, "Enter the opening hours").max(200, "Keep it under 200 characters"),
});

export type StoreFormValues = z.infer<typeof storeSchema>;

export const emptyStore: StoreFormValues = {
  name: "",
  slug: "",
  address: "",
  area: "",
  city: "",
  latitude: "",
  longitude: "",
  phone: "",
  whatsapp: "",
  hours: "",
};

export function storeToForm(s: Store): StoreFormValues {
  return {
    name: s.name,
    slug: s.slug,
    address: s.address,
    area: s.area,
    city: s.city,
    latitude: String(Number(s.latitude)),
    longitude: String(Number(s.longitude)),
    phone: s.phone ?? "",
    whatsapp: s.whatsapp ?? "",
    hours: s.hours,
  };
}

export function storeToInput(v: StoreFormValues): StoreInput {
  return { ...v, slug: v.slug || null, phone: v.phone || null, whatsapp: v.whatsapp || null };
}
