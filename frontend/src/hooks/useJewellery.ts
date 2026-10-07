import { useCallback, useEffect, useState } from "react";
import { ApiError, errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import type { Jewellery, JewelleryQuery, Page } from "@/types";

/** Fetches one jewellery record. `notFound` is set when the ID doesn't exist. */
export function useJewelleryRecord(id: string | undefined) {
  const [item, setItem] = useState<Jewellery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    setNotFound(false);
    jewelleryService
      .get(id)
      .then(setItem)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(errorMessage(err));
      });
  }, [id]);

  useEffect(load, [load]);

  return { item, setItem, error, notFound, loading: !item && !error && !notFound, reload: load };
}

/** Paged, filtered list. Aborts in-flight requests when the query changes. */
export function useJewelleryList(query: JewelleryQuery) {
  const [data, setData] = useState<Page<Jewellery> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    jewelleryService
      .list(JSON.parse(key) as JewelleryQuery, controller.signal)
      .then((page) => {
        setData(page);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError(errorMessage(err));
        setLoading(false);
      });
    return () => controller.abort();
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
