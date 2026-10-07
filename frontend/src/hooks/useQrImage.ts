import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import { saveBlob } from "@/utils/download";

/** Loads the print-resolution QR PNG (an authenticated request) for display and download. */
export function useQrImage(jewelleryId: string | undefined) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jewelleryId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setError(null);
    jewelleryService
      .qrImage(jewelleryId)
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "QR code could not be generated.")));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [jewelleryId]);

  const download = useCallback(() => {
    if (!blob || !jewelleryId) return;
    saveBlob(blob, `${jewelleryId}-qr.png`);
    toast.success("QR code downloaded.");
  }, [blob, jewelleryId]);

  return { url, error, loading: !url && !error, download };
}
