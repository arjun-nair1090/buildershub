import { Gem, Plus, Search, SearchX, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { JewelleryTable, PaginationBar } from "@/components/jewellery/JewelleryTable";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { useDebounce } from "@/hooks/useDebounce";
import { useJewelleryList } from "@/hooks/useJewellery";
import { errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import { JEWELLERY_TYPES, PURITIES, type Jewellery, type JewelleryQuery, type SortField } from "@/types";

const PAGE_SIZE = 10;

export function JewelleryListPage() {
  // Filters live in the URL so a filtered view survives refresh and the back button.
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debouncedSearch = useDebounce(search.trim(), 300);

  const query: JewelleryQuery = useMemo(
    () => ({
      search: params.get("search") ?? "",
      type: (params.get("type") ?? "") as JewelleryQuery["type"],
      purity: (params.get("purity") ?? "") as JewelleryQuery["purity"],
      status: (params.get("status") ?? "") as JewelleryQuery["status"],
      sort: (params.get("sort") as SortField) || "created_at",
      order: (params.get("order") as "asc" | "desc") || "desc",
      page: Number(params.get("page")) || 1,
      page_size: PAGE_SIZE,
    }),
    [params],
  );
  const { data, error, loading, reload } = useJewelleryList(query);

  function update(next: Partial<Record<keyof JewelleryQuery, string | number>>, resetPage = true) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(next)) {
          if (v === "" || v === undefined) p.delete(k);
          else p.set(k, String(v));
        }
        if (resetPage) p.delete("page");
        return p;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    document.title = "Jewellery";
  }, []);

  useEffect(() => {
    if (debouncedSearch !== (params.get("search") ?? "")) update({ search: debouncedSearch });
  }, [debouncedSearch]);

  function onSort(field: SortField) {
    const order = query.sort === field && query.order === "desc" ? "asc" : "desc";
    update({ sort: field, order });
  }

  async function deactivate(item: Jewellery) {
    try {
      await jewelleryService.deactivate(item.jewellery_id);
      toast.success("Jewellery record deactivated.");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const filtered = Boolean(query.search || query.type || query.purity || query.status);
  const clearFilters = () => {
    setSearch("");
    setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Jewellery"
        description={data ? `${data.total} ${filtered ? "matching" : "registered"} ${data.total === 1 ? "record" : "records"}` : "Registered records"}
        actions={
          <Link to="/admin/jewellery/new" className={buttonVariants({ size: "lg" })}>
            <Plus /> Add Jewellery
          </Link>
        }
      />

      <Panel>
        <div className="grid gap-3 border-b border-line p-4 sm:p-5 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Jewellery ID, certificate ID or type"
              aria-label="Search jewellery"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-3 lg:contents">
            <Select aria-label="Filter by type" value={query.type} onChange={(e) => update({ type: e.target.value })} className="lg:w-36">
              <option value="">All types</option>
              {JEWELLERY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select aria-label="Filter by purity" value={query.purity} onChange={(e) => update({ purity: e.target.value })} className="lg:w-32">
              <option value="">All purities</option>
              {PURITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Select aria-label="Filter by status" value={query.status} onChange={(e) => update({ status: e.target.value })} className="lg:w-32">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>

        {filtered && (
          <div className="flex items-center justify-between border-b border-line bg-ivory/60 px-5 py-2 text-[13px] text-muted">
            Filters applied
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X /> Clear filters
            </Button>
          </div>
        )}

        {error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={reload}>
              Try again
            </Button>
          </div>
        ) : !loading && data?.items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title="No records match"
              description="Try a different ID or certificate number, or clear the filters."
              action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={Gem}
              title="No jewellery registered yet"
              description="Register your first piece to create its digital record and QR code."
              action={
                <Link to="/admin/jewellery/new" className={buttonVariants()}>
                  <Plus /> Add Jewellery
                </Link>
              }
            />
          )
        ) : (
          <div className={loading && data ? "opacity-60 transition-opacity" : undefined}>
            <JewelleryTable
              items={data?.items ?? []}
              loading={loading && !data}
              skeletonRows={8}
              columns={["id", "type", "purity", "weight", "certificate", "price", "status"]}
              sort={query.sort}
              order={query.order}
              onSort={onSort}
              onDeactivate={deactivate}
            />
          </div>
        )}

        {data && (
          <PaginationBar page={data.page} pageSize={data.page_size} total={data.total} onPage={(page) => update({ page }, false)} />
        )}
      </Panel>
    </>
  );
}
