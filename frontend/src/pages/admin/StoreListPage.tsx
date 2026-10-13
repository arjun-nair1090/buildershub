import { PencilLine, Plus, Power, PowerOff, Store as StoreIcon, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StatusBadge } from "@/components/jewellery/StatusBadge";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/hooks/useStores";
import { errorMessage } from "@/services/api";
import { storeService } from "@/services/stores";
import type { Store } from "@/types";

const iconLink = "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-basalt-50 hover:text-ink";

export function StoreListPage() {
  const { stores, setStores, error, reload } = useStores();

  useEffect(() => {
    document.title = "Stores";
  }, []);

  function replace(updated: Store) {
    setStores((all) => all && all.map((s) => (s.slug === updated.slug ? updated : s)));
  }

  async function toggle(store: Store) {
    try {
      const active = store.status === "active";
      replace(active ? await storeService.deactivate(store.slug) : await storeService.activate(store.slug));
      toast.success(active ? `${store.name} is hidden from buyers.` : `${store.name} is visible to buyers again.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(store: Store) {
    try {
      await storeService.remove(store.slug);
      setStores((all) => all && all.filter((s) => s.slug !== store.slug));
      toast.success(`${store.name} deleted.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const addButton = (
    <Link to="/admin/stores/new" className={buttonVariants({ size: "lg" })}>
      <Plus /> Add store
    </Link>
  );

  return (
    <>
      <PageHeader title="Stores" description="The shops whose pieces and designs buyers can browse." actions={addButton} />
      <Panel>
        {error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={reload}>
              Try again
            </Button>
          </div>
        ) : stores === null ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <EmptyState icon={StoreIcon} title="No stores yet" description="Add a store, then add its pieces and designs." action={addButton} />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead className="border-b border-line text-[13px] text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Store</th>
                  <th className="px-5 py-3 text-right font-medium">Pieces</th>
                  <th className="px-5 py-3 text-right font-medium">Designs</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stores.map((store) => (
                  <tr key={store.slug}>
                    <td className="px-5 py-3">
                      <Link to={`/admin/stores/${store.slug}/edit`} className="font-medium text-ink hover:underline">
                        {store.name}
                      </Link>
                      <p className="text-[13px] text-muted">
                        {store.area}, {store.city}
                      </p>
                    </td>
                    <td className="tabular px-5 py-3 text-right">{store.piece_count}</td>
                    <td className="tabular px-5 py-3 text-right">{store.design_count}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={store.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/admin/stores/${store.slug}/edit`} className={iconLink} aria-label={`Edit ${store.name}`} title="Edit">
                          <PencilLine className="size-4" />
                        </Link>
                        <ConfirmDialog
                          title={store.status === "active" ? `Hide ${store.name}?` : `Show ${store.name} again?`}
                          description={
                            store.status === "active"
                              ? "Buyers stop seeing its pieces and designs, and its QR codes say the record is no longer active."
                              : "Its published pieces and designs become visible to buyers again."
                          }
                          confirmLabel={store.status === "active" ? "Deactivate" : "Reactivate"}
                          tone={store.status === "active" ? "danger" : "primary"}
                          onConfirm={() => toggle(store)}
                          trigger={
                            <button type="button" className={iconLink} aria-label={`${store.status === "active" ? "Deactivate" : "Reactivate"} ${store.name}`}>
                              {store.status === "active" ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                            </button>
                          }
                        />
                        {store.piece_count + store.design_count === 0 && (
                          <ConfirmDialog
                            title={`Delete ${store.name}?`}
                            description="The store and its photos are removed permanently."
                            confirmLabel="Delete store"
                            onConfirm={() => remove(store)}
                            trigger={
                              <button type="button" className={iconLink} aria-label={`Delete ${store.name}`}>
                                <Trash2 className="size-4" />
                              </button>
                            }
                          />
                        )}
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
