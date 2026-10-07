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
}

/** Itemised like a jeweller's estimate: label, dotted leader, amount. */
export function PriceBreakdown({ className, emphasis, ...p }: PriceBreakdownProps) {
  const lines: [string, string | number][] = [
    ["Gold value", p.gold_value],
    ["Making charges", p.making_charges],
    ["Stone / other components", p.other_component_value],
    ["Tax", p.tax],
  ];

  return (
    <div className={className}>
      <dl className="space-y-3">
        {lines.map(([label, value]) => (
          <div key={label} className="flex items-baseline text-[15px]">
            <dt className="text-charcoal/80">{label}</dt>
            <span className="leader" aria-hidden />
            <dd className="tabular text-charcoal">{formatINR(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-charcoal/80 pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[15px] font-semibold text-charcoal">Total price</span>
          <span
            className={cn(
              "tabular font-semibold text-emerald",
              emphasis ? "text-[28px] leading-none sm:text-[32px]" : "text-xl",
            )}
          >
            {formatINR(p.total_price)}
          </span>
        </div>
      </div>
    </div>
  );
}
