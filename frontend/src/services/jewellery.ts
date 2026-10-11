import { request, requestBlob } from "./api";
import type { Jewellery, JewelleryInput, JewelleryQuery, JewelleryStats, Page, PiecePrice, PricePreviewInput } from "@/types";

const base = "/api/jewellery";
const one = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const jewelleryService = {
  list: (query: JewelleryQuery, signal?: AbortSignal) =>
    request<Page<Jewellery>>(base, { query: { ...query }, signal }),
  stats: () => request<JewelleryStats>(`${base}/stats`),
  get: (id: string) => request<Jewellery>(one(id)),
  create: (data: JewelleryInput) => request<Jewellery>(base, { method: "POST", body: data }),
  update: (id: string, data: JewelleryInput) => request<Jewellery>(one(id), { method: "PUT", body: data }),
  deactivate: (id: string) => request<Jewellery>(one(id), { method: "DELETE" }),
  activate: (id: string) => request<Jewellery>(`${one(id)}/activate`, { method: "POST" }),
  pricePreview: (data: PricePreviewInput, signal?: AbortSignal) =>
    request<PiecePrice>(`${base}/price-preview`, { method: "POST", body: data, signal }),

  qrImage: (id: string) => requestBlob(`${one(id)}/qr`),

  uploadCertificate: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Jewellery>(`${one(id)}/certificate`, { method: "POST", body: form });
  },
  downloadCertificate: (id: string) => requestBlob(`${one(id)}/certificate`),
  removeCertificate: (id: string) => request<Jewellery>(`${one(id)}/certificate`, { method: "DELETE" }),
};
