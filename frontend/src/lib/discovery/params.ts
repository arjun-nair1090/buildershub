import { JEWELLERY_TYPES, PURITIES } from "@/types";
import { DEFAULT_FILTERS, DISTANCES, SORTS, TABS, type Filters } from "./search";

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/** Reads filters from the URL. Anything unknown or malformed is dropped rather than breaking the page. */
export function filtersFromParams(p: URLSearchParams): Filters {
  const list = <T extends string>(key: string, allowed: readonly T[]) =>
    (p.get(key) ?? "").split(",").filter((v): v is T => (allowed as readonly string[]).includes(v));
  const num = (key: string) => {
    const raw = p.get(key);
    if (raw === null || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const km = num("km");
  return {
    q: p.get("q") ?? "",
    tab: oneOf(p.get("tab"), TABS) ?? DEFAULT_FILTERS.tab,
    categories: list("cat", JEWELLERY_TYPES),
    purities: list("purity", PURITIES),
    weightMin: num("wmin"),
    weightMax: num("wmax"),
    priceMin: num("pmin"),
    priceMax: num("pmax"),
    km: km !== null && (DISTANCES as readonly number[]).includes(km) ? km : null,
    city: p.get("city")?.trim() || null,
    sort: oneOf(p.get("sort"), SORTS) ?? DEFAULT_FILTERS.sort,
  };
}

/** Only what differs from the defaults goes in the URL. The buyer's location never does. */
export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  // Kept as typed (not trimmed): the search box writes here on every keystroke, so a trailing space must survive.
  if (f.q.trim()) p.set("q", f.q);
  if (f.tab !== DEFAULT_FILTERS.tab) p.set("tab", f.tab);
  if (f.categories.length) p.set("cat", f.categories.join(","));
  if (f.purities.length) p.set("purity", f.purities.join(","));
  const nums: [string, number | null][] = [
    ["wmin", f.weightMin],
    ["wmax", f.weightMax],
    ["pmin", f.priceMin],
    ["pmax", f.priceMax],
    ["km", f.km],
  ];
  for (const [key, value] of nums) if (value !== null) p.set(key, String(value));
  if (f.city) p.set("city", f.city);
  if (f.sort !== DEFAULT_FILTERS.sort) p.set("sort", f.sort);
  return p;
}
