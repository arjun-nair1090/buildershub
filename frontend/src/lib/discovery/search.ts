import type { Catalog, CatalogDesign, CatalogPiece, CatalogStore, JewelleryType, Purity } from "@/types";
import { distanceKm, type Point } from "./distance";

export const TABS = ["pieces", "designs", "stores"] as const;
export type Tab = (typeof TABS)[number];
export const SORTS = ["newest", "price_asc", "price_desc", "nearest"] as const;
export type Sort = (typeof SORTS)[number];
export const DISTANCES = [2, 5, 10, 25] as const;

export interface Filters {
  q: string;
  tab: Tab;
  categories: JewelleryType[];
  purities: Purity[];
  weightMin: number | null;
  weightMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  km: number | null;
  city: string | null;
  sort: Sort;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  tab: "pieces",
  categories: [],
  purities: [],
  weightMin: null,
  weightMax: null,
  priceMin: null,
  priceMax: null,
  km: null,
  city: null,
  sort: "newest",
};

export type Located<T> = T & { distanceKm: number | null };

export interface Results {
  pieces: Located<CatalogPiece>[];
  designs: Located<CatalogDesign>[];
  stores: Located<CatalogStore>[];
}

const mid = (min: string, max: string) => (Number(min) + Number(max)) / 2;
const within = (value: number, min: number | null, max: number | null) =>
  (min === null || value >= min) && (max === null || value <= max);
const overlaps = (lo: number, hi: number, min: number | null, max: number | null) =>
  (max === null || lo <= max) && (min === null || hi >= min);

/** How many filters in the panel are set, for the "Filters (n)" button. */
export function activeFilterCount(f: Filters): number {
  return (
    f.categories.length +
    f.purities.length +
    Number(f.weightMin !== null || f.weightMax !== null) +
    Number(f.priceMin !== null || f.priceMax !== null) +
    Number(f.km !== null)
  );
}

/**
 * Filters and sorts the catalogue for one search. `here` is the buyer's location when they allowed it; without
 * it, the distance filter is ignored and "nearest" falls back to "newest", so a shared link still shows results.
 */
export function searchCatalog(catalog: Catalog, f: Filters, here: Point | null): Results {
  const stores = new Map(catalog.stores.map((s) => [s.slug, s]));
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const textMatches = (...fields: string[]) => {
    const haystack = fields.join(" ").toLowerCase();
    return terms.every((t) => haystack.includes(t));
  };
  const distanceTo = (s: CatalogStore) =>
    here ? distanceKm(here, { lat: Number(s.latitude), lng: Number(s.longitude) }) : null;
  const placeMatches = (s: CatalogStore, d: number | null) =>
    (f.city === null || s.city === f.city) && (f.km === null || d === null || d <= f.km);

  const pieces: Located<CatalogPiece>[] = [];
  for (const p of catalog.pieces) {
    const s = stores.get(p.store);
    if (!s) continue;
    const d = distanceTo(s);
    if (
      placeMatches(s, d) &&
      textMatches(p.title, p.type, s.name, s.area, s.city) &&
      (f.categories.length === 0 || f.categories.includes(p.type)) &&
      (f.purities.length === 0 || f.purities.includes(p.purity)) &&
      within(Number(p.net_weight), f.weightMin, f.weightMax) &&
      within(mid(p.price.final_min, p.price.final_max), f.priceMin, f.priceMax)
    )
      pieces.push({ ...p, distanceKm: d });
  }

  const designs: Located<CatalogDesign>[] = [];
  for (const x of catalog.designs) {
    const s = stores.get(x.store);
    if (!s) continue;
    const d = distanceTo(s);
    if (
      placeMatches(s, d) &&
      textMatches(x.title, x.category, s.name, s.area, s.city) &&
      (f.categories.length === 0 || f.categories.includes(x.category)) &&
      (f.purities.length === 0 || x.purity_options.some((k) => f.purities.includes(k))) &&
      overlaps(Number(x.weight_min), Number(x.weight_max), f.weightMin, f.weightMax) &&
      overlaps(Number(x.price_min), Number(x.price_max), f.priceMin, f.priceMax)
    )
      designs.push({ ...x, distanceKm: d });
  }

  const storeResults: Located<CatalogStore>[] = [];
  for (const s of catalog.stores) {
    const d = distanceTo(s);
    if (placeMatches(s, d) && textMatches(s.name, s.area, s.city)) storeResults.push({ ...s, distanceKm: d });
  }

  const sort = f.sort === "nearest" && !here ? "newest" : f.sort;
  const byDistance = <T extends { distanceKm: number | null }>(a: T, b: T) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
  const pieceMid = (p: CatalogPiece) => mid(p.price.final_min, p.price.final_max);
  const designMid = (x: CatalogDesign) => mid(x.price_min, x.price_max);

  // The catalogue arrives newest first, and Array.prototype.sort is stable, so "newest" needs no sort.
  if (sort === "price_asc") {
    pieces.sort((a, b) => pieceMid(a) - pieceMid(b));
    designs.sort((a, b) => designMid(a) - designMid(b));
  } else if (sort === "price_desc") {
    pieces.sort((a, b) => pieceMid(b) - pieceMid(a));
    designs.sort((a, b) => designMid(b) - designMid(a));
  } else if (sort === "nearest") {
    pieces.sort(byDistance);
    designs.sort(byDistance);
  }
  if (sort === "nearest") storeResults.sort(byDistance);
  else storeResults.sort((a, b) => a.name.localeCompare(b.name));

  return { pieces, designs, stores: storeResults };
}
