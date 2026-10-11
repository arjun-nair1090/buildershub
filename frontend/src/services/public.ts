import { request } from "./api";
import type { PublicDesign, PublicStore } from "@/types";

export const publicService = {
  store: (slug: string, signal?: AbortSignal) =>
    request<PublicStore>(`/api/public/stores/${encodeURIComponent(slug)}`, { auth: false, signal }),
  design: (id: string, signal?: AbortSignal) =>
    request<PublicDesign>(`/api/public/designs/${encodeURIComponent(id)}`, { auth: false, signal }),
};
