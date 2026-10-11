import { apiUrl, request, requestBlob } from "./api";
import type { Photo, PhotoOwner } from "@/types";

export type PhotoSize = "full" | "thumb";

const ownerPath = (owner: PhotoOwner, key: string) => `/api/${owner}/${encodeURIComponent(key)}/photos`;
const photoPath = (id: string) => `/api/photos/${encodeURIComponent(id)}`;

/** Every change returns the owner's photos in their new order. */
export const photoService = {
  upload: (owner: PhotoOwner, key: string, file: File, altText = "") => {
    const form = new FormData();
    form.append("file", file);
    form.append("alt_text", altText);
    return request<Photo[]>(ownerPath(owner, key), { method: "POST", body: form });
  },
  reorder: (owner: PhotoOwner, key: string, photoIds: string[]) =>
    request<Photo[]>(`${ownerPath(owner, key)}/order`, { method: "PUT", body: { photo_ids: photoIds } }),
  updateAlt: (id: string, altText: string) => request<Photo[]>(photoPath(id), { method: "PUT", body: { alt_text: altText } }),
  remove: (id: string) => request<Photo[]>(photoPath(id), { method: "DELETE" }),
  /** Signed-in fetch, so admins also see photos of drafts. */
  blob: (id: string, size: PhotoSize) => requestBlob(`${photoPath(id)}/${size}`),
  /** Plain URL for photos buyers can see. */
  url: (id: string, size: PhotoSize) => apiUrl(`${photoPath(id)}/${size}`),
};
