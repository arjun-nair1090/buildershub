import { errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import type { Jewellery, JewelleryInput } from "@/types";

/**
 * Save a piece and its certificate file. Lab verified needs the file on record first, so when a new
 * file arrives with that level the piece is saved as "declared", the file uploaded, then the level set.
 */
export async function savePiece(
  id: string | null,
  input: JewelleryInput,
  certificate: File | null,
  hasDocument: boolean,
): Promise<{ item: Jewellery; warning: string | null }> {
  const fileFirst = input.verification_level === "lab" && certificate !== null && !hasDocument;
  const first = fileFirst ? { ...input, verification_level: "declared" as const } : input;
  let item = id ? await jewelleryService.update(id, first) : await jewelleryService.create(first);

  if (certificate) {
    try {
      item = await jewelleryService.uploadCertificate(item.jewellery_id, certificate);
    } catch (err) {
      const then = fileFirst ? ", then choose Lab verified" : "";
      return { item, warning: `Saved, but the certificate didn't upload: ${errorMessage(err)} Add it from Edit${then}.` };
    }
  }
  if (fileFirst) item = await jewelleryService.update(item.jewellery_id, input);
  return { item, warning: null };
}
