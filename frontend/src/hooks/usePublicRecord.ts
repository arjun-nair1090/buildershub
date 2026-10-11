import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "@/services/api";

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "found"; data: T }
  | { kind: "not-found" }
  | { kind: "gone" }
  | { kind: "error"; message: string };

/** Loads one public record by key: 404 (or a malformed key, 422) is "not found", 410 is "gone". */
export function usePublicRecord<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    load(controller.signal)
      .then((data) => setState({ kind: "found", data }))
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 422)) setState({ kind: "not-found" });
        else if (err instanceof ApiError && err.status === 410) setState({ kind: "gone" });
        else setState({ kind: "error", message: errorMessage(err, "Check your connection and try again.") });
      });
    return () => controller.abort();
    // `load` is recreated every render; the key and the retry count are what decide a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
