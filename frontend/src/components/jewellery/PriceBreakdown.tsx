import type { CSSProperties, ReactNode } from "react";
import type { LivePrice } from "@/types";
import { formatINR, formatINRRange, formatPercent } from "@/utils/format";
import { cn } from "@/utils/cn";

interface PriceBreakdownProps {
  gold_value: string | number;
  making_charges: string | number;
  other_component_value: string | number;
  tax: string | number;
  total_price: string | number;
  /** Price at the current gold rate. Replaces the registered amounts when given. */
  live?: LivePrice | null;
  className?: string;
  /** Larger total for the buyer-facing page. */
  emphasis?: boolean;
  /** Delay (ms) at which the lines start rising in, one after another. Omit for no entrance. */
  stagger?: number;
}

type Line = { label: string; amount: string; note?: ReactNode };

function liveLines(live: LivePrice): Line[] {
  const ranged = live.making_percent_min !== null && live.making_percent_max !== null;
  return [
    { label: "Gold value", amount: formatINR(live.gold_value), note: `At ${formatINR(live.rate_per_gram)}/g today` },
    {
      label: "Making charges",
      amount: formatINRRange(live.making_charges_min, live.making_charges_max),
      note: ranged ? `${formatPercent(live.making_percent_min!)}–${formatPercent(live.making_percent_max!)} of gold value` : undefined,
    },
    { label: "Stone / other components", amount: formatINR(live.other_component_value) },
    { label: "Tax", amount: formatINRRange(live.tax_min, live.tax_max), note: `GST ${formatPercent(live.gst_percent)}` },
  ];
}

/** Itemised like a jeweller's estimate: label, dotted leader, amount. */
export function PriceBreakdown({ className, emphasis, stagger, live, ...p }: PriceBreakdownProps) {
  const lines: Line[] = live
    ? liveLines(live)
    : [
        { label: "Gold value", amount: formatINR(p.gold_value) },
        { label: "Making charges", amount: formatINR(p.making_charges) },
        { label: "Stone / other components", amount: formatINR(p.other_component_value) },
        { label: "Tax", amount: formatINR(p.tax) },
      ];
  const total = live ? formatINRRange(live.total_min, live.total_max) : formatINR(p.total_price);
  const ranged = live && Number(live.total_min) !== Number(live.total_max);

  const animate = stagger !== undefined && "rise";
  const at = (i: number) => (stagger === undefined ? undefined : ({ "--d": `${stagger + i * 90}ms` } as CSSProperties));

  return (
    <div className={className}>
      <dl className="space-y-3">
        {lines.map(({ label, amount, note }, i) => (
          <div key={label} className={cn("text-[15px]", animate)} style={at(i)}>
            <div className="flex items-baseline">
              <dt className="text-ink/80">{label}</dt>
              <span className="leader" aria-hidden />
              <dd className="tabular whitespace-nowrap text-ink">{amount}</dd>
            </div>
            {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
          </div>
        ))}
      </dl>
      <div className={cn("mt-5 border-t border-ink/80 pt-4", animate)} style={at(lines.length + 1)}>
        <div className={cn("flex justify-between gap-x-4 gap-y-1", ranged ? "flex-wrap items-end" : "items-baseline")}>
          <span className="text-[15px] font-semibold text-ink">{live ? "Live price" : "Total price"}</span>
          <span
            className={cn(
              "tabular ml-auto text-right font-semibold text-basalt",
              emphasis ? (ranged ? "text-[24px] leading-tight tracking-tight sm:text-[26px]" : "text-[30px] leading-none tracking-tight sm:text-[34px]") : "text-xl",
            )}
          >
            {total}
          </span>
        </div>
        {live && (
          <p className="mt-2 text-right text-xs text-muted">Moves with the gold rate. The final bill is confirmed in store.</p>
        )}
      </div>
    </div>
  );
}
