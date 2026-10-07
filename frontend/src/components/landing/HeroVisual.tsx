import { BadgeCheck } from "lucide-react";
import { useMemo } from "react";
import { HallmarkStamp } from "@/components/jewellery/HallmarkStamp";

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

function Caption({ n, children }: { n: string; children: string }) {
  return (
    <p className="mt-4 text-center text-[13px] text-muted">
      <span className="tabular mr-1.5 font-semibold text-gold">{n}</span>
      {children}
    </p>
  );
}

/** Jewellery → QR → Verification, drawn as three objects joined by a gold thread. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-label="A ring with a QR tag, which opens a verified record on a phone" role="img">
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden pt-[calc((100%-3rem)/6-20px)] sm:block" aria-hidden>
      <svg viewBox="0 0 560 40" className="w-full" preserveAspectRatio="none">
        <path
          d="M85 20 H475"
          stroke="#B08D57"
          strokeWidth="1"
          strokeDasharray="3 5"
          fill="none"
          style={{ ["--len" as string]: 300, animation: "draw 1.4s 0.3s ease-out both" }}
        />
      </svg>
      </div>

      <div className="relative grid grid-cols-3 items-start gap-3 sm:gap-6">
        {/* Jewellery */}
        <div>
          <div className="grid aspect-square place-items-center rounded-lg border border-line bg-white">
            <svg viewBox="0 0 120 120" className="w-[78%]" aria-hidden>
              <ellipse cx="60" cy="72" rx="34" ry="30" fill="none" stroke="#B08D57" strokeWidth="5" />
              <ellipse cx="60" cy="72" rx="27" ry="23.5" fill="none" stroke="#B08D57" strokeOpacity=".35" strokeWidth="1" />
              <path d="M48 42 L54 30 H66 L72 42 L60 52 Z" fill="#FAF9F6" stroke="#173F35" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M48 42 H72 M54 30 L60 42 L66 30 M60 42 V52" stroke="#173F35" strokeWidth="1" strokeOpacity=".55" fill="none" />
            </svg>
          </div>
          <Caption n="01">Jewellery</Caption>
        </div>

        {/* QR tag */}
        <div>
          <div className="relative grid aspect-square place-items-center rounded-lg border border-line bg-white">
            <div className="w-[70%] rounded-[3px] border border-line-strong bg-white p-[7%] shadow-[0_1px_0_#E6E1D8]">
              <DecorativeQr className="w-full text-emerald" />
              <p className="tabular mt-1.5 text-center text-[8px] tracking-[0.12em] text-emerald sm:text-[9px]">JWL-26-A8F72K</p>
            </div>
          </div>
          <Caption n="02">QR tag</Caption>
        </div>

        {/* Verification on the buyer's phone */}
        <div>
          <div className="aspect-square overflow-hidden rounded-lg border border-line bg-white">
            <div className="bg-emerald px-[9%] pb-[8%] pt-[10%] text-ivory">
              <BadgeCheck className="size-4 text-gold sm:size-5" strokeWidth={1.5} />
              <p className="mt-1 font-display text-[11px] leading-tight sm:text-[15px]">Verified record</p>
            </div>
            <div className="space-y-[6%] px-[9%] py-[9%]">
              <HallmarkStamp purity="22K" percent="91.6" className="h-6 px-1.5 text-[10px] sm:h-8 sm:px-2.5 sm:text-[13px]" />
              <div className="flex items-baseline justify-between text-[9px] text-muted sm:text-[11px]">
                <span>Total</span>
                <span className="tabular font-semibold text-emerald">₹1,25,000</span>
              </div>
            </div>
          </div>
          <Caption n="03">Verification</Caption>
        </div>
      </div>
    </div>
  );
}
