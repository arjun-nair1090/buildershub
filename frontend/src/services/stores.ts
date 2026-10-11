import { request } from "./api";
import type { Store, StoreInput } from "@/types";

const base = "/api/stores";
const one = (slug: string) => `${base}/${encodeURIComponent(slug)}`;

export const storeService = {
  list: () => request<Store[]>(base),
  get: (slug: string) => request<Store>(one(slug)),
  create: (data: StoreInput) => request<Store>(base, { method: "POST", body: data }),
  update: (slug: string, data: StoreInput) => request<Store>(one(slug), { method: "PUT", body: data }),
  remove: (slug: string) => request<void>(one(slug), { method: "DELETE" }),
  activate: (slug: string) => request<Store>(`${one(slug)}/activate`, { method: "POST" }),
  deactivate: (slug: string) => request<Store>(`${one(slug)}/deactivate`, { method: "POST" }),
};
