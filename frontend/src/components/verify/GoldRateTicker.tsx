import { TrendingDown, TrendingUp } from "lucide-react";
import { PURITIES, type GoldRate, type Purity } from "@/types";
import { cn } from "@/utils/cn";
import { formatAgo, formatINR } from "@/utils/format";

function Change({ value, className, announce = true }: { value: string | null; className?: string; announce?: boolean }) {
  if (value === null || Number(value) === 0) return null;
  const up = Number(value) > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular", className)}>
      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      {announce && <span className="sr-only">{up ? "Up" : "Down"}</span>}
      {Math.abs(Number(value)).toFixed(2)}%
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)} aria-hidden>
      <span className="absolute inset-0 animate-ping rounded-full bg-verified/60" />
      <span className="relative size-2 rounded-full bg-verified" />
    </span>
  );
}

/** Rate per gram for each karat, with the piece's own karat picked out. */
export function GoldRateTicker({ rate, highlight }: { rate: GoldRate; highlight?: Purity }) {
  const up = Number(rate.change_percent ?? 0) >= 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[13px] text-muted">
          <LiveDot /> Market rate per gram
        </p>
        <Change value={rate.change_percent} className={cn("text-[13px] font-medium", up ? "text-verified" : "text-danger")} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
        {PURITIES.map((k) => {
          const mine = k === highlight;
          return (
            <div
              key={k}
              className={cn("rounded-md border px-3 py-2.5", mine ? "border-gold/60 bg-gold-soft" : "border-line bg-white")}
            >
              <dt className="flex items-baseline justify-between gap-2 text-xs text-muted">
                <span className="font-semibold text-ink">{k}</span>
                {mine && <span className="text-gold-deep">This piece</span>}
              </dt>
              <dd className="tabular mt-0.5 text-[15px] font-medium text-ink">{formatINR(rate.per_gram[k])}</dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-xs text-muted">
        From {rate.source}, updated {formatAgo(rate.updated_at)}.
      </p>
    </div>
  );
}

/**
 * Scrolling tape of the current rates, for the top of the buyer page. Decorative: the same figures are in
 * GoldRateTicker, so it's hidden from screen readers.
 */
export function GoldRateTape({ rate }: { rate: GoldRate }) {
  const up = Number(rate.change_percent ?? 0) >= 0;
  const items = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      <span className="inline-flex items-center gap-2 font-semibold tracking-[0.12em] text-gold-bright">
        <LiveDot /> GOLD
      </span>
      {PURITIES.map((k) => (
        <span key={k} className="tabular whitespace-nowrap">
          <span className="text-chalk/60">{k}</span> {formatINR(rate.per_gram[k])}/g
        </span>
      ))}
      <Change value={rate.change_percent} announce={false} className={up ? "text-[#7fc4a0]" : "text-[#e39a8f]"} />
      <span className="whitespace-nowrap text-chalk/60">Updated {formatAgo(rate.updated_at)}</span>
    </div>
  );
  return (
    <div className="grain overflow-hidden py-3 text-[13px] text-chalk sm:rounded-lg" aria-hidden>
      {/* Each half holds two copies, so a half is wider than the widest strip and the loop never shows a gap. */}
      <div className="flex w-max animate-[ticker_56s_linear_infinite] hover:[animation-play-state:paused]">
        {items}
        {items}
        {items}
        {items}
      </div>
    </div>
  );
}
