import { hallmarkCode } from "@/utils/format";
import { cn } from "@/utils/cn";

interface HallmarkStampProps {
  purity: string;
  percent: string;
  size?: "md" | "lg";
  className?: string;
}

/**
 * Purity rendered the way it is struck on hallmarked gold: a cartouche reading "22K916".
 * Purely a display of the registered value; it is not a claim of physical testing.
 */
export function HallmarkStamp({ purity, percent, size = "md", className }: HallmarkStampProps) {
  const code = hallmarkCode(purity, percent);
  return (
    <span
      role="img"
      aria-label={`Registered purity ${purity}, ${percent}% gold`}
      className={cn(
        "relative inline-flex items-center justify-center rounded-[3px] border border-gold font-display text-ink",
        "before:absolute before:inset-[3px] before:rounded-[2px] before:border before:border-gold/45 before:content-['']",
        size === "lg" ? "h-14 px-5 text-[26px] tracking-[0.08em]" : "h-9 px-3 text-base tracking-[0.06em]",
        className,
      )}
    >
      {code}
    </span>
  );
}
