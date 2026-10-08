import { BadgeCheck } from "lucide-react";
import { useId, useMemo, type CSSProperties } from "react";

/** Deterministic decorative QR-like grid (21×21 with finder patterns). Not scannable by design. */
function DecorativeQr({ className }: { className?: string }) {
  const cells = useMemo(() => {
    const size = 21;
    const out: [number, number][] = [];
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const inFinder = (x: number, y: number) =>
      (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!inFinder(x, y) && rand() > 0.52) out.push([x, y]);
    return out;
  }, []);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="currentColor" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 23 23" className={className} aria-hidden shapeRendering="crispEdges">
      <rect x="-1" y="-1" width="23" height="23" fill="#fff" />
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

/** A brilliant-cut gem in side profile, drawn facet by facet in fine gold line. */
const OUTLINE = "M100 40 H200 L280 95 L150 225 L20 95 Z";
const FACETS = [
  { d: "M20 95 H280", at: 700 }, // girdle
  { d: "M60 95 L100 40 L125 95 L150 40 L175 95 L200 40 L240 95", at: 850 }, // crown
  { d: "M60 95 L150 225 M125 95 L150 225 M175 95 L150 225 M240 95 L150 225", at: 1050 }, // pavilion
];
const drawn = (at: number, duration = 1.2) => ({
  strokeDasharray: 1,
  ["--len" as string]: 1,
  animation: `draw ${duration}s ${at}ms cubic-bezier(.22,1,.36,1) both`,
});
const SPIN_FREE = { transformBox: "fill-box", transformOrigin: "center" } as const;

function HeroGem() {
  const id = useId();
  return (
    <svg viewBox="0 0 300 240" className="w-full overflow-visible" aria-hidden>
      <defs>
        {/* userSpaceOnUse: a bounding-box gradient can't paint the flat girdle line (its box has no height). */}
        <linearGradient id={`${id}-gold`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="240">
          <stop offset="0" stopColor="#F3DDA6" />
          <stop offset="0.55" stopColor="#D4AE6A" />
          <stop offset="1" stopColor="#9C7637" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={OUTLINE} />
        </clipPath>
      </defs>
      {/* Faint body, so the stone has weight once it is drawn. */}
      <path d={OUTLINE} fill={`url(#${id}-gold)`} fillOpacity=".09" style={{ animation: "fade 1.4s 1.3s ease-out both" }} />
      <g fill="none" stroke={`url(#${id}-gold)`} strokeLinejoin="round">
        <path d={OUTLINE} pathLength={1} strokeWidth="1.6" style={drawn(300, 1.5)} />
        {FACETS.map((f) => (
          <path key={f.d} d={f.d} pathLength={1} strokeWidth="0.9" strokeOpacity=".75" style={drawn(f.at)} />
        ))}
      </g>
      {/* One sweep of light across the stone. */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect
          x="0" y="0" width="90" height="240" fill="#fff" fillOpacity=".22"
          style={{ ...SPIN_FREE, animation: "glint 1.8s 2.1s cubic-bezier(.22,1,.36,1) both" }}
        />
      </g>
      {/* A star of light on the table's edge as the sweep passes. */}
      <path
        d="M206 28 L209 37 L218 40 L209 43 L206 52 L203 43 L194 40 L203 37 Z"
        fill="#F3DDA6"
        style={{ ...SPIN_FREE, animation: "strike 700ms 2.9s cubic-bezier(.22,1,.36,1) both" }}
      />
    </svg>
  );
}

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** The hero: a gem in its display case, its tag, and the record a buyer sees when they scan it. */
export function HeroVisual() {
  return (
    <div
      className="relative mx-auto w-full max-w-[560px] pb-16 sm:pb-10"
      role="img"
      aria-label="A gold-outlined gem beside its QR tag and a verified record showing 22 karat purity and an itemised total"
    >
      {/* The display case */}
      <div className="grain relative aspect-[6/5] overflow-hidden rounded-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_40px_80px_-40px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
        <div className="pointer-events-none absolute inset-3 rounded-[15px] border border-gold/25" aria-hidden />
        <div className="absolute inset-x-0 top-[9%] mx-auto w-[54%]">
          <HeroGem />
        </div>

        {/* QR tag hanging on the stone */}
        <div className="rise absolute bottom-7 left-6 w-[28%] sm:left-8" style={delay(1150)}>
          <div className="-rotate-[5deg] rounded-[6px] bg-white p-[9%] shadow-[0_18px_30px_-14px_rgba(0,0,0,0.7)]">
            <DecorativeQr className="w-full text-basalt" />
            <p className="tabular mt-1.5 text-center text-[7px] tracking-[0.1em] text-basalt sm:text-[9px]">JWL-26-A8F72K</p>
          </div>
        </div>
      </div>

      {/* The record on the buyer's phone */}
      <div
        className="rise absolute -bottom-0 right-3 w-[62%] overflow-hidden rounded-[14px] bg-white text-ink shadow-[0_30px_60px_-24px_rgba(10,14,16,0.75)] sm:-right-6 sm:bottom-[-6px] sm:w-[54%]"
        style={delay(1450)}
      >
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-gold-bright/25 to-transparent"
          style={{ animation: "glint 1.4s 2.1s cubic-bezier(.22,1,.36,1) both" }}
          aria-hidden
        />
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
          <BadgeCheck className="size-4 text-verified sm:size-5" strokeWidth={1.75} />
          <p className="font-display text-[15px] leading-none sm:text-[18px]">Verified record</p>
        </div>
        <dl className="space-y-1.5 px-4 py-3 text-[11px] sm:px-5 sm:py-4 sm:text-[13px]">
          {[
            ["Jewellery ID", "JWL-26-A8F72K"],
            ["Purity", "22K / 91.6%"],
            ["Net gold", "15.42 g"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted">{k}</dt>
              <dd className="tabular">{v}</dd>
            </div>
          ))}
          <div className="!mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
            <dt className="font-medium">Total</dt>
            <dd className="tabular text-[16px] font-semibold tracking-tight text-basalt sm:text-[19px]">₹1,25,000</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
