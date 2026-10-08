import type { CSSProperties } from "react";
import { formatINR } from "@/utils/format";
import { cn } from "@/utils/cn";

interface PriceBreakdownProps {
  gold_value: string | number;
  making_charges: string | number;
  other_component_value: string | number;
  tax: string | number;
  total_price: string | number;
  className?: string;
  /** Larger total for the buyer-facing page. */
  emphasis?: boolean;
  /** Delay (ms) at which the lines start rising in, one after another. Omit for no entrance. */
  stagger?: number;
}

/** Itemised like a jeweller's estimate: label, dotted leader, amount. */
export function PriceBreakdown({ className, emphasis, stagger, ...p }: PriceBreakdownProps) {
  const lines: [string, string | number][] = [
    ["Gold value", p.gold_value],
    ["Making charges", p.making_charges],
    ["Stone / other components", p.other_component_value],
    ["Tax", p.tax],
  ];
  const animate = stagger !== undefined && "rise";
  const at = (i: number) => (stagger === undefined ? undefined : ({ "--d": `${stagger + i * 90}ms` } as CSSProperties));

  return (
    <div className={className}>
      <dl className="space-y-3">
        {lines.map(([label, value], i) => (
          <div key={label} className={cn("flex items-baseline text-[15px]", animate)} style={at(i)}>
            <dt className="text-ink/80">{label}</dt>
            <span className="leader" aria-hidden />
            <dd className="tabular text-ink">{formatINR(value)}</dd>
          </div>
        ))}
      </dl>
      <div className={cn("mt-5 border-t border-ink/80 pt-4", animate)} style={at(lines.length + 1)}>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[15px] font-semibold text-ink">Total price</span>
          <span
            className={cn(
              "tabular font-semibold text-basalt",
              emphasis ? "text-[30px] leading-none tracking-tight sm:text-[34px]" : "text-xl",
            )}
          >
            {formatINR(p.total_price)}
          </span>
        </div>
      </div>
    </div>
  );
}
