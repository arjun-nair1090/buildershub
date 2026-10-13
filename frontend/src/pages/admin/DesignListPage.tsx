import { Palette, PencilLine, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/hooks/useStores";
import { errorMessage } from "@/services/api";
import { designService } from "@/services/designs";
import type { Design } from "@/types";
import { formatINRRange } from "@/utils/format";

const iconLink = "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-basalt-50 hover:text-ink";

export function DesignListPage() {
  const { stores } = useStores();
  const [store, setStore] = useState("");
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    designService
      .list({ store })
      .then(setDesigns)
      .catch((err) => setError(errorMessage(err)));
  }, [store]);

  useEffect(() => {
    document.title = "Designs";
    load();
  }, [load]);

  async function remove(design: Design) {
    try {
      await designService.remove(design.public_id);
      setDesigns((all) => all && all.filter((d) => d.public_id !== design.public_id));
      toast.success(`${design.title} deleted.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const addButton = (
    <Link to="/admin/designs/new" className={buttonVariants({ size: "lg" })}>
      <Plus /> Add design
    </Link>
  );

  return (
    <>
      <PageHeader title="Designs" description="Pieces a store can make to order. Buyers see them as approximate, never as verified." actions={addButton} />
      <Panel>
        <div className="border-b border-line p-4 sm:p-5">
          <div className="sm:w-64">
            <Select aria-label="Filter by store" value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="">All stores</option>
              {stores?.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={load}>
              Try again
            </Button>
          </div>
        ) : designs === null ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : designs.length === 0 ? (
          <EmptyState icon={Palette} title="No designs yet" description="Add the designs a store can make, with an approximate price and making time." action={addButton} />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[15px]">
              <thead className="border-b border-line text-[13px] text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Design</th>
                  <th className="px-5 py-3 font-medium">Store</th>
                  <th className="px-5 py-3 text-right font-medium">Approx. price</th>
                  <th className="px-5 py-3 font-medium">Making time</th>
                  <th className="px-5 py-3 font-medium">Listing</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {designs.map((d) => (
                  <tr key={d.public_id}>
                    <td className="px-5 py-3">
                      <Link to={`/admin/designs/${d.public_id}/edit`} className="font-medium text-ink hover:underline">
                        {d.title}
                      </Link>
                      <p className="text-[13px] text-muted">
                        {d.category} · {d.purity_options.join(", ")}
                      </p>
                    </td>
                    <td className="px-5 py-3">{d.store.name}</td>
                    <td className="tabular px-5 py-3 text-right">{formatINRRange(d.price_min, d.price_max)}</td>
                    <td className="px-5 py-3">
                      {d.making_days_min === d.making_days_max ? d.making_days_min : `${d.making_days_min}–${d.making_days_max}`} days
                    </td>
                    <td className="px-5 py-3 text-[13px]">{d.is_published ? "Published" : <span className="text-muted">Draft</span>}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/admin/designs/${d.public_id}/edit`} className={iconLink} aria-label={`Edit ${d.title}`} title="Edit">
                          <PencilLine className="size-4" />
                        </Link>
                        <ConfirmDialog
                          title={`Delete ${d.title}?`}
                          description="The design and its photos are removed permanently."
                          confirmLabel="Delete design"
                          onConfirm={() => remove(d)}
                          trigger={
                            <button type="button" className={iconLink} aria-label={`Delete ${d.title}`}>
                              <Trash2 className="size-4" />
                            </button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
