import { request } from "./api";
import type { StoreSettings } from "@/types";

export const settingsService = {
  get: () => request<StoreSettings>("/api/settings"),
  update: (data: { gst_percent: string }) =>
    request<StoreSettings>("/api/settings", { method: "PUT", body: data }),
};
