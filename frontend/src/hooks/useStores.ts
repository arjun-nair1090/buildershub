import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/services/api";
import { storeService } from "@/services/stores";
import type { Store } from "@/types";

export function useStores() {
  const [stores, setStores] = useState<Store[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    storeService
      .list()
      .then(setStores)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);
  return { stores, setStores, error, reload: load };
}
