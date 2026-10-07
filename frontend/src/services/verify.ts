import { request } from "./api";
import type { PublicVerification } from "@/types";

export const verifyService = {
  verify: (code: string, signal?: AbortSignal) =>
    request<PublicVerification>(`/api/verify/${encodeURIComponent(code.trim())}`, { auth: false, signal }),
};
