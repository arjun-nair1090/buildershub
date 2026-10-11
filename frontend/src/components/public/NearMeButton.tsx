import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { useNearMe } from "@/hooks/useNearMe";
import type { Point } from "@/lib/discovery/distance";
import { cn } from "@/utils/cn";

interface NearMeButtonProps {
  /** Called with the location, or null when it isn't available. */
  onResult: (here: Point | null) => void;
  tone?: "light" | "dark";
  className?: string;
}

/** Says why before the browser asks, so the prompt never comes out of nowhere. */
export function NearMeButton({ onResult, tone = "light", className }: NearMeButtonProps) {
  const { here, status, request } = useNearMe();
  const [explaining, setExplaining] = useState(false);
  const dark = tone === "dark";

  if (explaining) {
    return (
      <div
        role="group"
        aria-label="Use your location"
        className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm", dark ? "border-white/25 text-chalk" : "border-line-strong bg-white text-ink", className)}
      >
        <p className="min-w-0 flex-1 basis-56">Your location stays on this device and is only used to sort by distance.</p>
        <button
          type="button"
          className="font-semibold underline-offset-4 hover:underline"
          onClick={async () => {
            setExplaining(false);
            onResult(await request());
          }}
        >
          Continue
        </button>
        <button type="button" className={cn("underline-offset-4 hover:underline", dark ? "text-chalk/70" : "text-muted")} onClick={() => setExplaining(false)}>
          Not now
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (here ? onResult(here) : setExplaining(true))}
      disabled={status === "asking"}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors disabled:opacity-60",
        dark ? "border-white/30 text-chalk hover:border-gold-bright hover:text-gold-bright" : "border-line-strong bg-white text-ink hover:border-basalt/40",
        className,
      )}
    >
      <LocateFixed className="size-4" strokeWidth={1.75} aria-hidden />
      {status === "asking" ? "Finding you…" : here ? "Near me ✓" : "Near me"}
    </button>
  );
}
