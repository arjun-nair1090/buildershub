import { ArrowRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PieceTile } from "@/components/public/PieceTile";
import { StoreTile } from "@/components/public/StoreTile";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/hooks/useCatalog";
import { useNearMe } from "@/hooks/useNearMe";
import { distanceKm } from "@/lib/discovery/distance";

function Row({ title, link, children }: { title: string; link: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-[28px] leading-tight text-ink sm:text-[34px]">{title}</h2>
        <Link to={link.to} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-basalt underline-offset-4 hover:underline">
          {link.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {/* Phones scroll sideways; wider screens get a grid. */}
      <div className="-mx-4 mt-5 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}

const cell = "w-40 shrink-0 snap-start sm:w-auto";

/** Stores and the newest pieces, from the catalogue. Each row hides when empty. */
export function CatalogRows() {
  const { state, retry } = useCatalog();
  const { here } = useNearMe();
  const catalog = state.kind === "found" ? state.data : null;
  const stores = useMemo(() => {
    if (!catalog) return [];
    const located = catalog.stores.map((s) => ({
      store: s,
      km: here ? distanceKm(here, { lat: Number(s.latitude), lng: Number(s.longitude) }) : null,
    }));
    return here ? located.sort((a, b) => (a.km ?? 0) - (b.km ?? 0)) : located;
  }, [catalog, here]);

  if (state.kind === "loading") {
    return (
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-10 sm:grid-cols-4 sm:px-6" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    );
  }
  if (!catalog) {
    return (
      <p className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted sm:px-6">
        Couldn't load the catalogue.{" "}
        <button type="button" onClick={retry} className="font-medium text-basalt underline-offset-4 hover:underline">
          Try again
        </button>
      </p>
    );
  }

  return (
    <>
      {stores.length > 0 && (
        <Row title="Stores" link={{ to: "/search?tab=stores", label: "All stores" }}>
          {stores.map(({ store, km }) => (
            <div key={store.slug} className={cell}>
              <StoreTile store={store} distanceKm={km} />
            </div>
          ))}
        </Row>
      )}
      {catalog.pieces.length > 0 && (
        <Row title="New pieces" link={{ to: "/search", label: "See all" }}>
          {catalog.pieces.slice(0, 8).map((piece) => (
            <div key={piece.jewellery_id} className={cell}>
              <PieceTile piece={piece} />
            </div>
          ))}
        </Row>
      )}
    </>
  );
}
