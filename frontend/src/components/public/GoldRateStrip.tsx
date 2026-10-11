import { useEffect, useState } from "react";
import { LiveDot } from "@/components/verify/GoldRateTicker";
import { publicService } from "@/services/public";
import type { GoldRate } from "@/types";
import { formatAgo, formatINR } from "@/utils/format";

const REFRESH_MS = 60_000;

/** 24K and 22K per gram. Keeps the last rate it had when a refresh fails; never blank. */
export function GoldRateStrip() {
  // undefined: first load still running; null: no rate available.
  const [rate, setRate] = useState<GoldRate | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () =>
      publicService
        .goldRate()
        .then((next) => alive && setRate((prev) => next ?? prev ?? null))
        .catch(() => alive && setRate((prev) => prev ?? null));
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <section aria-label="Gold rate" className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
        <span className="inline-flex items-center gap-2 font-semibold text-gold-deep">
          <LiveDot /> Gold rate
        </span>
        {rate === undefined ? (
          <span className="text-muted">Loading…</span>
        ) : rate === null ? (
          <span className="text-muted">Gold rate unavailable right now</span>
        ) : (
          <>
            <span className="tabular text-ink">
              24K <strong className="font-semibold">{formatINR(rate.per_gram["24K"])}</strong>/g
            </span>
            <span className="tabular text-ink">
              22K <strong className="font-semibold">{formatINR(rate.per_gram["22K"])}</strong>/g
            </span>
            <span className="text-muted">Updated {formatAgo(rate.updated_at)}</span>
          </>
        )}
      </div>
    </section>
  );
}
