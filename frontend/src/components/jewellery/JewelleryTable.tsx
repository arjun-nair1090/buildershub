import { ArrowDown, ArrowUp, ArrowUpDown, Eye, PencilLine, PowerOff } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Jewellery, SortField } from "@/types";
import { cn } from "@/utils/cn";
import { formatDate, formatINRRange, formatWeight } from "@/utils/format";
import { LevelBadge, ListingBadge, StatusBadge } from "./StatusBadge";

type ColumnKey = "id" | "title" | "store" | "type" | "purity" | "weight" | "level" | "listing" | "price" | "status" | "created";

interface Column {
  key: ColumnKey;
  label: string;
  sort?: SortField;
  align?: "right";
  render: (j: Jewellery) => ReactNode;
}

const COLUMNS: Record<ColumnKey, Column> = {
  id: {
    key: "id",
    label: "Jewellery ID",
    sort: "jewellery_id",
    render: (j) => (
      <Link to={`/admin/jewellery/${j.jewellery_id}`} className="tabular font-medium tracking-wide text-ink hover:underline">
        {j.jewellery_id}
      </Link>
    ),
  },
  title: {
    key: "title",
    label: "Title",
    render: (j) => (
      <>
        {j.title}
        <span className="block text-[13px] text-muted">{j.store.name}</span>
      </>
    ),
  },
  store: { key: "store", label: "Store", render: (j) => j.store.name },
  type: { key: "type", label: "Category", sort: "type", render: (j) => j.type },
  purity: { key: "purity", label: "Purity", render: (j) => j.purity },
  weight: { key: "weight", label: "Net weight", sort: "net_weight", align: "right", render: (j) => formatWeight(j.net_weight) },
  level: { key: "level", label: "Verification", render: (j) => <LevelBadge level={j.verification_level} /> },
  listing: { key: "listing", label: "Listing", render: (j) => <ListingBadge published={j.is_published} stock={j.stock_status} /> },
  price: {
    key: "price",
    label: "Price now",
    sort: "total_price",
    align: "right",
    render: (j) => formatINRRange(j.price.final_min, j.price.final_max),
  },
  status: { key: "status", label: "Status", render: (j) => <StatusBadge status={j.status} /> },
  created: { key: "created", label: "Created", sort: "created_at", render: (j) => formatDate(j.created_at) },
};

interface JewelleryTableProps {
  items: Jewellery[];
  columns: ColumnKey[];
  loading?: boolean;
  skeletonRows?: number;
  sort?: SortField;
  order?: "asc" | "desc";
  onSort?: (field: SortField) => void;
  onDeactivate: (item: Jewellery) => Promise<void>;
}

function RowActions({ item, onDeactivate }: { item: Jewellery; onDeactivate: (item: Jewellery) => Promise<void> }) {
  const link = "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-basalt-50 hover:text-ink";
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link to={`/admin/jewellery/${item.jewellery_id}`} className={link} title="View" aria-label={`View ${item.jewellery_id}`}>
        <Eye className="size-4" />
      </Link>
      <Link to={`/admin/jewellery/${item.jewellery_id}/edit`} className={link} title="Edit" aria-label={`Edit ${item.jewellery_id}`}>
        <PencilLine className="size-4" />
      </Link>
      {item.status === "active" ? (
        <ConfirmDialog
          title={`Deactivate ${item.jewellery_id}?`}
          description="Its QR code will stop verifying and buyers will see that the record is inactive. You can reactivate it later."
          confirmLabel="Deactivate"
          onConfirm={() => onDeactivate(item)}
          trigger={
            <button type="button" className={cn(link, "hover:bg-danger-50 hover:text-danger")} title="Deactivate" aria-label={`Deactivate ${item.jewellery_id}`}>
              <PowerOff className="size-4" />
            </button>
          }
        />
      ) : (
        <span className="size-8" aria-hidden />
      )}
    </div>
  );
}

export function JewelleryTable({ items, columns, loading, skeletonRows = 5, sort, order, onSort, onDeactivate }: JewelleryTableProps) {
  const cols = columns.map((c) => COLUMNS[c]);

  return (
    <>
      {/* Desktop and tablet: table */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[13px] text-muted">
              {cols.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-3 font-medium first:pl-6", c.align === "right" && "text-right")}>
                  {c.sort && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.sort!)}
                      className={cn("inline-flex items-center gap-1 hover:text-ink", sort === c.sort && "text-ink")}
                    >
                      {c.label}
                      {sort === c.sort ? (
                        order === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 pr-6 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={i}>
                    {cols.map((c) => (
                      <td key={c.key} className="px-4 py-4 first:pl-6">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                    <td className="px-4 py-4 pr-6" />
                  </tr>
                ))
              : items.map((j) => (
                  <tr key={j.jewellery_id} className={cn("transition-colors hover:bg-canvas/70", j.status === "inactive" && "text-muted")}>
                    {cols.map((c) => (
                      <td key={c.key} className={cn("whitespace-nowrap px-4 py-3.5 first:pl-6", c.align === "right" && "tabular text-right")}>
                        {c.render(j)}
                      </td>
                    ))}
                    <td className="px-4 py-2 pr-4">
                      <RowActions item={j} onDeactivate={onDeactivate} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Phones: stacked records */}
      <ul className="divide-y divide-line md:hidden">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="space-y-2 px-5 py-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </li>
            ))
          : items.map((j) => (
              <li key={j.jewellery_id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {COLUMNS.id.render(j)}
                    <p className="mt-0.5 truncate text-sm text-ink">
                      {j.title}, {j.purity}, {formatWeight(j.net_weight)}
                    </p>
                  </div>
                  <StatusBadge status={j.status} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="tabular text-[15px] font-semibold text-ink">{formatINRRange(j.price.final_min, j.price.final_max)}</span>
                  <RowActions item={j} onDeactivate={onDeactivate} />
                </div>
              </li>
            ))}
      </ul>
    </>
  );
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3 text-[13px] text-muted sm:px-6">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
