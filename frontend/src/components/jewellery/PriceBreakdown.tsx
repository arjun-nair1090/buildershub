import type { CSSProperties } from "react";
import type { PiecePrice } from "@/types";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime, formatINR, formatINRRange, formatPercent } from "@/utils/format";

interface PriceBreakdownProps {
  price: PiecePrice;
  className?: string;
  /** Larger final price for the buyer-facing page. */
  emphasis?: boolean;
  /** Delay (ms) at which the lines start rising in, one after another. Omit for no entrance. */
  stagger?: number;
}

type Line = { label: string; amount: string; note?: string };

/** Itemised like a jeweller's estimate: label, dotted leader, amount. The lines add up to the final price. */
export function PriceBreakdown({ price, className, emphasis, stagger }: PriceBreakdownProps) {
  const ranged = price.making_percent_min !== null && price.making_percent_max !== null;
  const lines: Line[] = [
    { label: "Gold value", amount: formatINR(price.gold), note: price.rate_per_gram ? `At ${formatINR(price.rate_per_gram)}/g today` : undefined },
    {
      label: "Making charges",
      amount: formatINRRange(price.making_min, price.making_max),
      note: ranged ? `${formatPercent(price.making_percent_min!)}–${formatPercent(price.making_percent_max!)} of gold value` : undefined,
    },
    { label: "Stone / other components", amount: formatINR(price.other) },
    { label: "Tax", amount: formatINRRange(price.tax_min, price.tax_max), note: `GST ${formatPercent(price.gst_percent)}` },
  ];
  const { discount } = price;
  const rangedFinal = Number(price.final_min) !== Number(price.final_max);

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

      <div className={cn("mt-5 space-y-2 border-t border-ink/80 pt-4", animate)} style={at(lines.length + 1)}>
        {discount && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-[15px]">
              <span className="text-ink/80">Original price</span>
              <s className="tabular text-muted">{formatINRRange(price.original_min, price.original_max)}</s>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-[15px]">
              <span className="inline-flex items-center gap-2 text-ink/80">
                Discount
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-deep">{discount.label}</span>
              </span>
              <span className="tabular text-verified">− {formatINRRange(discount.amount_min, discount.amount_max)}</span>
            </div>
          </>
        )}
        <div className={cn("flex justify-between gap-x-4 gap-y-1", rangedFinal ? "flex-wrap items-end" : "items-baseline")}>
          <span className="text-[15px] font-semibold text-ink">{discount ? "Final price" : "Price"}</span>
          <span
            className={cn(
              "tabular ml-auto text-right font-semibold text-basalt",
              emphasis ? (rangedFinal ? "text-[24px] leading-tight tracking-tight sm:text-[26px]" : "text-[30px] leading-none tracking-tight sm:text-[34px]") : "text-xl",
            )}
          >
            {formatINRRange(price.final_min, price.final_max)}
          </span>
        </div>
        <p className="text-right text-xs leading-relaxed text-muted">
          Price as of {formatDateTime(price.as_of)}
          {discount?.ends_on ? `. Offer ends ${formatDate(discount.ends_on)}` : ""}. Final price confirmed at the store.
        </p>
      </div>
    </div>
  );
}
