import { useEffect, useState } from "react";
import { jewelleryService } from "@/services/jewellery";

/** Object URL for a record's product photo (an authenticated request), or null while loading / when absent. */
export function usePhoto(jewelleryId: string | undefined, hasPhoto: boolean | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!jewelleryId || !hasPhoto) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    jewelleryService
      .photo(jewelleryId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        /* the record still renders without its photo */
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [jewelleryId, hasPhoto]);

  return url;
}
