import { useId } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";

/** One ingot in a 3/4 view, drawn in a 64 × 48 box: lit top, dark side, shaded front, a stamped panel and a bright edge. */
const INGOT = {
  top: "M12 21h32l8-11H20Z",
  side: "M44 21l8-11 6 19-8 11Z",
  front: "M5 40h45l-6-19H12Z",
  stamp: "M17.5 18.6h22.8l4.7-6.3H22.4Z",
  edge: "M12 21h32l8-11",
};

/** Where each ingot sits in the 63 × 32 mark: two on the bottom row, then the one resting on them, drawn last. */
const STACK = ["translate(-2 9) scale(.56)", "translate(30 9) scale(.56)", "translate(14 -5) scale(.56)"];

/** Three stacked gold bars: the "gold" in Jewlerify, and the dot on its i. */
export function GoldBars({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 63 32" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF4D6" />
          <stop offset="1" stopColor="#EBCB8C" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B98C45" />
          <stop offset="1" stopColor="#7E5D27" />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EBC781" />
          <stop offset="0.55" stopColor="#D4AE6A" />
          <stop offset="1" stopColor="#A97F3C" />
        </linearGradient>
      </defs>
      {STACK.map((transform) => (
        <g key={transform} transform={transform}>
          <path d={INGOT.top} fill={`url(#${id}-top)`} />
          <path d={INGOT.side} fill={`url(#${id}-side)`} />
          <path d={INGOT.front} fill={`url(#${id}-front)`} />
          <path d={INGOT.stamp} fill="none" stroke="#B48A44" strokeOpacity=".7" strokeWidth=".9" />
          <path d={INGOT.edge} fill="none" stroke="#FFF8E6" strokeOpacity=".85" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}

interface BrandMarkProps {
  to?: string;
  tone?: "dark" | "light";
  className?: string;
}

/** Wordmark: "Jewlerify" with stacked gold bars in place of the dot on the i. */
export function BrandMark({ to = "/", tone = "dark", className }: BrandMarkProps) {
  return (
    <Link to={to} className={cn("group inline-flex", className)} aria-label="Jewlerify, home">
      <span aria-hidden className={cn("font-display text-[28px] leading-none", tone === "dark" ? "text-ink" : "text-chalk")}>
        Jewler
        <span className="relative">
          ı
          <GoldBars className="absolute bottom-[0.8em] left-1/2 w-[0.52em] -translate-x-1/2 transition-transform duration-500 ease-out-soft group-hover:-translate-y-[0.1em] group-hover:rotate-6" />
        </span>
        fy
      </span>
    </Link>
  );
}
