import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Point } from "@/lib/discovery/distance";

export type NearMeStatus = "idle" | "asking" | "granted" | "denied" | "unavailable";

interface NearMe {
  here: Point | null;
  status: NearMeStatus;
  /** Asks the browser once; resolves with the location, or null when refused, unavailable or unanswered. */
  request: () => Promise<Point | null>;
}

const NearMeContext = createContext<NearMe | null>(null);
const GIVE_UP_MS = 10_000;

/** Holds the buyer's location in memory for the visit, shared by every page. Never stored or sent anywhere. */
export function NearMeProvider({ children }: { children: ReactNode }) {
  const [here, setHere] = useState<Point | null>(null);
  const [status, setStatus] = useState<NearMeStatus>("idle");

  const request = useCallback(
    () =>
      new Promise<Point | null>((resolve) => {
        if (!("geolocation" in navigator)) {
          setStatus("unavailable");
          resolve(null);
          return;
        }
        setStatus("asking");
        let settled = false;
        const finish = (point: Point | null, next: NearMeStatus) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          if (point) setHere(point);
          setStatus(next);
          resolve(point);
        };
        // The browser's own timeout only starts after the buyer answers the prompt, so we keep our own.
        const timer = window.setTimeout(() => finish(null, "unavailable"), GIVE_UP_MS);
        navigator.geolocation.getCurrentPosition(
          (pos) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "granted"),
          (err) => finish(null, err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
          { timeout: GIVE_UP_MS, maximumAge: 5 * 60_000 },
        );
      }),
    [],
  );

  const value = useMemo(() => ({ here, status, request }), [here, status, request]);
  return <NearMeContext.Provider value={value}>{children}</NearMeContext.Provider>;
}

export function useNearMe(): NearMe {
  const value = useContext(NearMeContext);
  if (!value) throw new Error("useNearMe must be used inside NearMeProvider");
  return value;
}
