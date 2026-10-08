import { useId } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";

const GEM = "M6 1.5h12l5 6-11 11-11-11Z";

/** A brilliant-cut gem in gold: the "jewel" in Jewlerify, and the dot on its i. */
export function Gem({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 24 20" aria-hidden className={className}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3DDA6" />
          <stop offset="0.5" stopColor="#D4AE6A" />
          <stop offset="1" stopColor="#9C7637" />
        </linearGradient>
        <clipPath id={`${gradient}-clip`}>
          <path d={GEM} />
        </clipPath>
      </defs>
      <path d={GEM} fill={`url(#${gradient})`} />
      {/* Facet lines clipped to the stone so their stroke never spills past its edge. */}
      <path
        clipPath={`url(#${gradient}-clip)`}
        d="M1 7.5h22M6 1.5l3.5 6L12 1.5l2.5 6 3.5-6M9.5 7.5 12 18.5l2.5-11"
        fill="none"
        stroke="#fff"
        strokeOpacity=".5"
        strokeWidth=".7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface BrandMarkProps {
  to?: string;
  tone?: "dark" | "light";
  className?: string;
}

/** Wordmark: "Jewlerify" with a gold gem in place of the dot on the i. */
export function BrandMark({ to = "/", tone = "dark", className }: BrandMarkProps) {
  return (
    <Link to={to} className={cn("group inline-flex", className)} aria-label="Jewlerify, home">
      <span aria-hidden className={cn("font-display text-[28px] leading-none", tone === "dark" ? "text-basalt" : "text-chalk")}>
        Jewler
        <span className="relative">
          ı
          <Gem className="absolute bottom-[0.74em] left-1/2 w-[0.42em] -translate-x-1/2 transition-transform duration-500 ease-out-soft group-hover:-translate-y-[0.1em] group-hover:rotate-12" />
        </span>
        fy
      </span>
    </Link>
  );
}
