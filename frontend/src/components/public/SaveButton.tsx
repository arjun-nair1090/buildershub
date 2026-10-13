import { Heart } from "lucide-react";
import { useSaved, type SavedKind } from "@/hooks/useSaved";
import { cn } from "@/utils/cn";

interface SaveButtonProps {
  kind: SavedKind;
  id: string;
  title: string;
  /** "overlay" sits on a photo; "inline" sits beside a heading. */
  variant?: "overlay" | "inline";
  className?: string;
}

/** Saves a piece or design on this device. Never inside a link, so it is its own tap target. */
export function SaveButton({ kind, id, title, variant = "overlay", className }: SaveButtonProps) {
  const { isSaved, toggle } = useSaved();
  const on = isSaved(kind, id);
  return (
    <button
      type="button"
      onClick={() => toggle(kind, id)}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from saved` : `Save ${title}`}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full transition-colors active:scale-95",
        variant === "overlay" ? "bg-white/90 text-ink shadow-md hover:bg-white" : "border border-line-strong bg-white text-ink hover:border-gold/40",
        className,
      )}
    >
      <Heart className={cn("size-5", on && "fill-danger text-danger")} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
