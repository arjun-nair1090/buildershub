import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";

export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="5" fill="#173F35" />
      <path d="M16 6.5 24.5 16 16 25.5 7.5 16Z" fill="none" stroke="#B08D57" strokeWidth="1.4" />
      <path d="M12.2 16.2 15 19l5-6" fill="none" stroke="#FAF9F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface BrandMarkProps {
  to?: string;
  tone?: "dark" | "light";
  compact?: boolean;
  className?: string;
}

export function BrandMark({ to = "/", tone = "dark", compact, className }: BrandMarkProps) {
  return (
    <Link to={to} className={cn("flex items-center gap-3", className)} aria-label="Jewellery Transparency & Verification System, home">
      <BrandGlyph />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("font-display text-[17px]", tone === "dark" ? "text-emerald" : "text-ivory")}>
            Jewellery Transparency
          </span>
          <span className={cn("mt-1 text-[11px] tracking-wide", tone === "dark" ? "text-muted" : "text-ivory/60")}>
            &amp; Verification System
          </span>
        </span>
      )}
    </Link>
  );
}
