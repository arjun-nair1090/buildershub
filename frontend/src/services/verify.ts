import { apiUrl, request } from "./api";
import type { PublicVerification } from "@/types";

const path = (code: string) => `/api/verify/${encodeURIComponent(code.trim())}`;

export const verifyService = {
  verify: (code: string, signal?: AbortSignal) => request<PublicVerification>(path(code), { auth: false, signal }),
  photoUrl: (code: string, version: string) => apiUrl(`${path(code)}/photo?v=${encodeURIComponent(version)}`),
};
