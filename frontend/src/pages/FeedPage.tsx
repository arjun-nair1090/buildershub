import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DesignTile } from "@/components/public/DesignTile";
import { PieceTile } from "@/components/public/PieceTile";
import { SaveButton } from "@/components/public/SaveButton";
import { Unavailable } from "@/components/public/Unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/hooks/useCatalog";
import { useSaved } from "@/hooks/useSaved";
import { feedTiles, type FeedTile } from "@/lib/discovery/feed";
import { photoService } from "@/services/photos";
import type { Catalog } from "@/types";
import { cn } from "@/utils/cn";

const PAGE = 30;

function Tile({ tile }: { tile: FeedTile }) {
  return (
    <div className="relative mb-3 break-inside-avoid">
      <Link to={tile.href} className="group block">
        <img
          src={photoService.url(tile.photo.public_id, "thumb")}
          alt={tile.photo.alt}
          width={tile.photo.width}
          height={tile.photo.height}
          loading="lazy"
          decoding="async"
          className="h-auto w-full rounded-md border border-line bg-canvas"
        />
        <p className="mt-1.5 truncate text-[14px] font-medium text-ink group-hover:underline">{tile.title}</p>
        <p className="tabular truncate text-[13px] text-muted">{tile.price}</p>
      </Link>
      <SaveButton kind={tile.kind} id={tile.id} title={tile.title} className="absolute right-2 top-2" />
    </div>
  );
}

function SavedView({ catalog }: { catalog: Catalog }) {
  const { saved, remove } = useSaved();
  if (saved.length === 0) {
    return <p className="rounded-lg border border-line bg-white px-6 py-12 text-center text-[15px] text-muted">Nothing saved yet. Tap the heart on any photo to keep it here.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {saved.map((key) => {
        const [kind, id] = key.split(/:(.*)/s);
        const piece = kind === "piece" ? catalog.pieces.find((p) => p.jewellery_id === id) : undefined;
        const design = kind === "design" ? catalog.designs.find((d) => d.public_id === id) : undefined;
        if (piece || design) {
          const title = piece?.title ?? design!.title;
          return (
            <div key={key} className="relative">
              {piece ? <PieceTile piece={piece} /> : <DesignTile design={design!} />}
              <SaveButton kind={kind as "piece" | "design"} id={id} title={title} className="absolute right-2 top-2" />
            </div>
          );
        }
        return (
          <div key={key} className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line-strong bg-white p-4 text-center">
            <p className="text-sm text-muted">No longer available</p>
            <button type="button" onClick={() => remove(key)} className="text-sm font-medium text-ink underline-offset-4 hover:underline">
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "saved" ? "saved" : "all";
  const { state, retry } = useCatalog();
  const { saved } = useSaved();
  const [count, setCount] = useState(PAGE);
  const tiles = useMemo(() => (state.kind === "found" ? feedTiles(state.data) : []), [state]);

  useEffect(() => {
    document.title = view === "saved" ? "Saved jewellery" : "Jewellery feed";
  }, [view]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[34px] leading-tight text-ink sm:text-[40px]">Feed</h1>
        <div role="tablist" aria-label="Feed view" className="flex rounded-md border border-line-strong bg-white p-1">
          {(["all", "saved"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setParams(v === "saved" ? { view: "saved" } : {}, { replace: true })}
              className={cn("rounded px-4 py-2 text-sm transition-colors", view === v ? "bg-gold-bright text-basalt" : "text-ink hover:bg-basalt-50")}
            >
              {v === "all" ? "All" : `Saved (${saved.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6" role="tabpanel" aria-label={view === "saved" ? "Saved" : "All photos"}>
        {state.kind === "loading" && (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className={cn("mb-3 w-full", i % 2 ? "aspect-[3/4]" : "aspect-square")} />
            ))}
          </div>
        )}
        {state.kind !== "loading" && state.kind !== "found" && (
          <Unavailable title="Couldn't load the catalogue" body={state.kind === "error" ? state.message : "Try again in a moment."} onRetry={retry} />
        )}
        {state.kind === "found" && view === "saved" && <SavedView catalog={state.data} />}
        {state.kind === "found" && view === "all" && (
          <>
            {tiles.length === 0 ? (
              <p className="text-[15px] text-muted">No photos yet.</p>
            ) : (
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
                {tiles.slice(0, count).map((tile) => (
                  <Tile key={tile.key} tile={tile} />
                ))}
              </div>
            )}
            {count < tiles.length && (
              <div className="mt-6 text-center">
                <button type="button" onClick={() => setCount((n) => n + PAGE)} className="h-11 rounded-md border border-line-strong bg-white px-6 text-sm font-medium text-ink hover:border-gold/40">
                  Show more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
