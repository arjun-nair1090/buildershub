import { useEffect, useState } from "react";
import { photoService, type PhotoSize } from "@/services/photos";

/** Object URL for a photo fetched with the admin's token, so drafts' photos show too. Null while loading or on error. */
export function useAdminImage(publicId: string | undefined, size: PhotoSize = "thumb") {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!publicId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    photoService
      .blob(publicId, size)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        /* the page still renders without the image */
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [publicId, size]);

  return url;
}
