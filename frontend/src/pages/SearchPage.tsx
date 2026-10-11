import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { DesignTile } from "@/components/public/DesignTile";
import { NearMeButton } from "@/components/public/NearMeButton";
import { PieceTile } from "@/components/public/PieceTile";
import { StoreTile } from "@/components/public/StoreTile";
import { Unavailable } from "@/components/public/Unavailable";
import { FilterPanel } from "@/components/search/FilterPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/hooks/useCatalog";
import { useNearMe } from "@/hooks/useNearMe";
import { lastCity, rememberCity } from "@/lib/discovery/city";
import type { Point } from "@/lib/discovery/distance";
import { filtersFromParams, filtersToParams } from "@/lib/discovery/params";
import { activeFilterCount, DEFAULT_FILTERS, searchCatalog, TABS, type Filters, type Tab } from "@/lib/discovery/search";
import { cn } from "@/utils/cn";

const TAB_LABEL: Record<Tab, string> = { pieces: "Pieces", designs: "Designs", stores: "Stores" };
const NO_LOCATION = "Location isn't available. Pick a city instead.";

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const { state, retry } = useCatalog();
  const { here } = useNearMe();
  const routerState = useLocation().state as { pickCity?: boolean } | null;
  const [note, setNote] = useState<string | null>(routerState?.pickCity ? NO_LOCATION : null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const cityRef = useRef<HTMLSelectElement>(null);

  const update = (patch: Partial<Filters>, push = false) =>
    setParams(filtersToParams({ ...filters, ...patch }), { replace: !push });

  const catalog = state.kind === "found" ? state.data : null;
  const results = useMemo(() => (catalog ? searchCatalog(catalog, filters, here) : null), [catalog, filters, here]);
  const cities = useMemo(() => (catalog ? [...new Set(catalog.stores.map((s) => s.city))].sort() : []), [catalog]);
  const panelCount = activeFilterCount(filters);
  const shown = results ? results[filters.tab].length : 0;

  useEffect(() => {
    document.title = "Browse jewellery";
  }, []);
  // Arrived from the home page's Near me without a location: offer the city picker.
  useEffect(() => {
    if (routerState?.pickCity) cityRef.current?.focus();
  }, [routerState]);
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const onNearMe = (point: Point | null) => {
    if (point) {
      setNote(null);
      update({ sort: "nearest" });
      return;
    }
    setNote(NO_LOCATION);
    const remembered = lastCity();
    if (!filters.city && remembered && cities.includes(remembered)) update({ city: remembered });
    cityRef.current?.focus();
  };

  const clear = () => setParams(filtersToParams({ ...DEFAULT_FILTERS, tab: filters.tab, sort: filters.sort }), { replace: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-[34px] leading-tight text-ink sm:text-[40px]">Browse jewellery</h1>

      <form role="search" className="mt-5" onSubmit={(e) => e.preventDefault()}>
        <label className="relative block">
          <span className="sr-only">Search pieces, designs and stores</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search rings, necklaces, store names, areas"
            className="h-12 w-full rounded-md border border-line-strong bg-white pl-10 pr-3 text-[15px] text-ink placeholder:text-muted focus:border-basalt focus:outline-none"
          />
        </label>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <NearMeButton onResult={onNearMe} />
        <label className="min-w-0">
          <span className="sr-only">City</span>
          <select
            ref={cityRef}
            value={filters.city ?? ""}
            onChange={(e) => {
              const city = e.target.value || null;
              rememberCity(city);
              update({ city });
            }}
            className="h-11 rounded-md border border-line-strong bg-white px-3 text-sm text-ink"
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Sort</span>
          <select
            value={filters.sort === "nearest" && !here ? "newest" : filters.sort}
            onChange={(e) => update({ sort: e.target.value as Filters["sort"] })}
            className="h-11 rounded-md border border-line-strong bg-white px-3 text-sm text-ink"
          >
            <option value="newest">{filters.tab === "stores" ? "A to Z" : "Newest"}</option>
            {filters.tab !== "stores" && <option value="price_asc">Price: low to high</option>}
            {filters.tab !== "stores" && <option value="price_desc">Price: high to low</option>}
            {here && <option value="nearest">Nearest</option>}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-white px-4 text-sm font-medium text-ink lg:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters{panelCount > 0 && ` (${panelCount})`}
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 text-sm text-ink">
          {note}
        </p>
      )}

      <div role="tablist" aria-label="Results" className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filters.tab === tab}
            onClick={() => update({ tab }, true)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors",
              filters.tab === tab ? "border-basalt font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {TAB_LABEL[tab]}
            {results && <span className="tabular ml-1.5 text-muted">{results[tab].length}</span>}
          </button>
        ))}
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
        <aside className="hidden lg:block" aria-label="Filters">
          <FilterPanel filters={filters} onChange={(patch) => update(patch)} hasLocation={here !== null} />
          {panelCount > 0 && (
            <button type="button" onClick={clear} className="mt-2 text-sm font-medium text-basalt underline-offset-4 hover:underline">
              Clear filters
            </button>
          )}
        </aside>

        <div role="tabpanel" aria-label={TAB_LABEL[filters.tab]}>
          {state.kind === "loading" && (
            <Grid>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full" />
              ))}
            </Grid>
          )}
          {(state.kind === "error" || state.kind === "not-found" || state.kind === "gone") && (
            <Unavailable
              title="Couldn't load the catalogue"
              body={state.kind === "error" ? state.message : "Try again in a moment."}
              onRetry={retry}
            />
          )}
          {results && shown === 0 && (
            <div className="rounded-lg border border-line bg-white px-6 py-12 text-center">
              <p className="font-display text-[24px] text-ink">Nothing matches these filters</p>
              <button type="button" onClick={clear} className="mt-3 text-sm font-medium text-basalt underline-offset-4 hover:underline">
                Clear filters
              </button>
            </div>
          )}
          {results && shown > 0 && (
            <Grid>
              {filters.tab === "pieces" &&
                results.pieces.map((p) => <PieceTile key={p.jewellery_id} piece={p} distanceKm={p.distanceKm} />)}
              {filters.tab === "designs" &&
                results.designs.map((d) => <DesignTile key={d.public_id} design={d} distanceKm={d.distanceKm} />)}
              {filters.tab === "stores" &&
                results.stores.map((s) => <StoreTile key={s.slug} store={s} distanceKm={s.distanceKm} />)}
            </Grid>
          )}
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-basalt/50" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-xl bg-chalk">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-semibold text-ink">Filters</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close filters" className="grid size-10 place-items-center rounded-full hover:bg-basalt-50">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 py-4">
              <FilterPanel filters={filters} onChange={(patch) => update(patch)} hasLocation={here !== null} />
            </div>
            <div className="flex gap-3 border-t border-line px-4 py-3">
              <button type="button" onClick={clear} className="h-12 flex-1 rounded-md border border-line-strong bg-white text-sm font-medium text-ink">
                Clear
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} className="h-12 flex-[2] rounded-md bg-basalt text-sm font-medium text-chalk">
                Show {shown} {shown === 1 ? "result" : "results"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
