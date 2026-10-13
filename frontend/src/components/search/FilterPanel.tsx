import { useEffect, useState, type ReactNode } from "react";
import { DISTANCES, type Filters } from "@/lib/discovery/search";
import { JEWELLERY_TYPES, PURITIES } from "@/types";
import { cn } from "@/utils/cn";

interface FilterPanelProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  hasLocation: boolean;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="pb-5">
      <legend className="mb-2.5 text-[13px] font-semibold text-gold-deep">{title}</legend>
      {children}
    </fieldset>
  );
}

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-40",
        on ? "border-gold-bright bg-gold-bright text-basalt" : "border-line-strong bg-white text-ink hover:border-gold/40",
      )}
    >
      {children}
    </button>
  );
}

/** A number box that lets the buyer type freely ("1.", "") and only reports a value once it reads as one. */
function NumberBox({ label, value, onCommit }: { label: string; value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  return (
    <label className="block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        inputMode="decimal"
        placeholder={label}
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, "");
          setText(next);
          if (next === "") onCommit(null);
          else if (/^\d+(\.\d+)?$/.test(next)) onCommit(Number(next));
        }}
        className="h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none"
      />
    </label>
  );
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function FilterPanel({ filters, onChange, hasLocation }: FilterPanelProps) {
  const forStores = filters.tab === "stores";
  return (
    <div>
      {!forStores && (
        <>
          <Group title="Category">
            <div className="flex flex-wrap gap-2">
              {JEWELLERY_TYPES.map((c) => (
                <Chip key={c} on={filters.categories.includes(c)} onClick={() => onChange({ categories: toggle(filters.categories, c) })}>
                  {c}
                </Chip>
              ))}
            </div>
          </Group>
          <Group title="Purity">
            <div className="flex flex-wrap gap-2">
              {PURITIES.map((p) => (
                <Chip key={p} on={filters.purities.includes(p)} onClick={() => onChange({ purities: toggle(filters.purities, p) })}>
                  {p}
                </Chip>
              ))}
            </div>
          </Group>
          <Group title="Weight (g)">
            <div className="flex gap-2">
              <NumberBox label="Min weight" value={filters.weightMin} onCommit={(v) => onChange({ weightMin: v })} />
              <NumberBox label="Max weight" value={filters.weightMax} onCommit={(v) => onChange({ weightMax: v })} />
            </div>
          </Group>
          <Group title="Price (₹)">
            <div className="flex gap-2">
              <NumberBox label="Min price" value={filters.priceMin} onCommit={(v) => onChange({ priceMin: v })} />
              <NumberBox label="Max price" value={filters.priceMax} onCommit={(v) => onChange({ priceMax: v })} />
            </div>
          </Group>
        </>
      )}
      <Group title="Distance">
        <div className="flex flex-wrap gap-2">
          <Chip on={filters.km === null} onClick={() => onChange({ km: null })}>
            Any
          </Chip>
          {DISTANCES.map((km) => (
            <Chip key={km} on={filters.km === km} disabled={!hasLocation} onClick={() => onChange({ km })}>
              {km} km
            </Chip>
          ))}
        </div>
        {!hasLocation && <p className="mt-2 text-[13px] text-muted">Use Near me to filter by distance.</p>}
      </Group>
    </div>
  );
}
