const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,25,000 — Indian digit grouping, paise only when present. */
export function formatINR(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  // Show paise only when present, and then always as two digits (₹74,654.40, not ₹74,654.4).
  return Number.isInteger(n) ? inr.format(n) : inrPaise.format(n);
}

/** ₹9,160 – ₹13,740, or a single amount when both ends match. */
export function formatINRRange(min: string | number, max: string | number): string {
  return Number(min) === Number(max) ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
}

/** 12% or 12.5%, without trailing zeros from the API's "12.50". */
export function formatPercent(value: string | number): string {
  return `${Number(value)}%`;
}

/** "just now", "12 min ago", "3 h ago", or a date for anything older than a day. */
export function formatAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `on ${formatDate(iso)}`;
}

/** 16.02 g — two decimals unless the third is significant. */
export function formatWeight(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = Math.round(n * 1000) % 10 === 0 ? 2 : 3;
  return `${n.toFixed(digits)} g`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Plain dates (YYYY-MM-DD) are calendar dates; parse them locally so they don't shift a day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatPurity(purity: string, percent: string): string {
  return percent ? `${purity} / ${percent}%` : purity;
}

/** BIS hallmark notation: 22K at 91.6% reads "22K916". */
export function hallmarkCode(purity: string, percent: string): string {
  const fineness = Math.round(Number(percent) * 10);
  return Number.isFinite(fineness) && fineness > 0 ? `${purity}${fineness}` : purity;
}

/** Sum money values in paise to avoid floating-point drift. */
export function sumMoney(...values: (string | number | null | undefined)[]): number {
  const paise = values.reduce<number>((acc, v) => {
    const n = Number(v);
    return acc + (v !== "" && Number.isFinite(n) ? Math.round(n * 100) : 0);
  }, 0);
  return paise / 100;
}

/** 11 Oct 2026, 10:30 am */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
