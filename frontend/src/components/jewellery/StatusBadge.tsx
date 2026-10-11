import { STOCK_LABEL, VERIFICATION_LABEL, type RecordStatus, type StockStatus, type VerificationLevel } from "@/types";
import { cn } from "@/utils/cn";

const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

export function StatusBadge({ status, className }: { status: RecordStatus; className?: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        base,
        active ? "border-basalt/20 bg-basalt-50 text-basalt" : "border-line-strong bg-chalk text-muted",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-basalt" : "bg-muted/60")} aria-hidden />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/** The verification level, worded exactly as buyers see it. */
export function LevelBadge({ level, className }: { level: VerificationLevel; className?: string }) {
  return (
    <span
      className={cn(
        base,
        level === "lab" && "border-gold/40 bg-gold-soft text-[#7a5f35]",
        level === "hallmark" && "border-basalt/20 bg-basalt-50 text-basalt",
        level === "declared" && "border-line-strong bg-white text-ink",
        className,
      )}
    >
      {VERIFICATION_LABEL[level]}
    </span>
  );
}

/** "Draft" until published; then the stock status. */
export function ListingBadge({ published, stock, className }: { published: boolean; stock: StockStatus; className?: string }) {
  if (!published) return <span className={cn(base, "border-dashed border-line-strong bg-white text-muted", className)}>Draft</span>;
  return (
    <span className={cn(base, stock === "in_stock" ? "border-verified/30 bg-white text-verified" : "border-line-strong bg-chalk text-muted", className)}>
      {STOCK_LABEL[stock]}
    </span>
  );
}
