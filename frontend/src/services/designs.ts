import { request } from "./api";
import type { Design, DesignInput } from "@/types";

const base = "/api/designs";
const one = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const designService = {
  list: (query: { store?: string; published?: "true" | "false" | "" } = {}) =>
    request<Design[]>(base, { query: { ...query } }),
  get: (id: string) => request<Design>(one(id)),
  create: (data: DesignInput) => request<Design>(base, { method: "POST", body: data }),
  update: (id: string, data: DesignInput) => request<Design>(one(id), { method: "PUT", body: data }),
  remove: (id: string) => request<void>(one(id), { method: "DELETE" }),
};
