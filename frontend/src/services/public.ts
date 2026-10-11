import { request } from "./api";
import type { Catalog, GoldRate, PublicDesign, PublicStore } from "@/types";

export const publicService = {
  catalog: (signal?: AbortSignal) => request<Catalog>("/api/public/catalog", { auth: false, signal }),
  /** null before the first rate has ever been fetched. */
  goldRate: (signal?: AbortSignal) => request<GoldRate | null>("/api/public/gold-rate", { auth: false, signal }),
  store: (slug: string, signal?: AbortSignal) =>
    request<PublicStore>(`/api/public/stores/${encodeURIComponent(slug)}`, { auth: false, signal }),
  design: (id: string, signal?: AbortSignal) =>
    request<PublicDesign>(`/api/public/designs/${encodeURIComponent(id)}`, { auth: false, signal }),
};
