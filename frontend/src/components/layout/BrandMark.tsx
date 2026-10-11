import { useId } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";

const FRONT = "M1 18.5h22l-4-9.5H5Z";
const TOP = "M5 9l2.4-6h9.2L19 9Z";

/** A gold bar, seen from the front: the "gold" in Jewlerify, and the dot on its i. */
export function GoldBar({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 20" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3DDA6" />
          <stop offset="0.5" stopColor="#D4AE6A" />
          <stop offset="1" stopColor="#9C7637" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBF0D2" />
          <stop offset="1" stopColor="#E6C88F" />
        </linearGradient>
      </defs>
      <path d={TOP} fill={`url(#${id}-top)`} />
      <path d={FRONT} fill={`url(#${id}-front)`} />
      {/* The bright edge where the top meets the front. */}
      <path d="M5.2 9h13.6" stroke="#fff" strokeOpacity=".55" strokeWidth=".7" strokeLinecap="round" />
    </svg>
  );
}

interface BrandMarkProps {
  to?: string;
  tone?: "dark" | "light";
  className?: string;
}

/** Wordmark: "Jewlerify" with a gold bar in place of the dot on the i. */
export function BrandMark({ to = "/", tone = "dark", className }: BrandMarkProps) {
  return (
    <Link to={to} className={cn("group inline-flex", className)} aria-label="Jewlerify, home">
      <span aria-hidden className={cn("font-display text-[28px] leading-none", tone === "dark" ? "text-basalt" : "text-chalk")}>
        Jewler
        <span className="relative">
          ı
          <GoldBar className="absolute bottom-[0.74em] left-1/2 w-[0.42em] -translate-x-1/2 transition-transform duration-500 ease-out-soft group-hover:-translate-y-[0.1em] group-hover:rotate-12" />
        </span>
        fy
      </span>
    </Link>
  );
}
