import { Gem, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { JewelleryTable } from "@/components/jewellery/JewelleryTable";
import { PageHeader } from "@/components/layout/AdminLayout";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useJewelleryList } from "@/hooks/useJewellery";
import { errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import type { Jewellery, JewelleryStats } from "@/types";

const STAT_CARDS: { key: keyof JewelleryStats; label: string; note: string }[] = [
  { key: "total", label: "Total jewellery", note: "All registered records" },
  { key: "active", label: "Active records", note: "QR codes that open a record" },
  { key: "verified", label: "Verified records", note: "Active, with a certificate reference" },
  { key: "inactive", label: "Inactive records", note: "Deactivated, not shown as verified" },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<JewelleryStats | null>(null);
  const recent = useJewelleryList({ page_size: 6, sort: "created_at", order: "desc" });

  const loadStats = useCallback(() => {
    jewelleryService.stats().then(setStats).catch((err) => toast.error(errorMessage(err)));
  }, []);

  useEffect(() => {
    document.title = "Dashboard";
    loadStats();
  }, [loadStats]);

  async function deactivate(item: Jewellery) {
    try {
      await jewelleryService.deactivate(item.jewellery_id);
      toast.success("Jewellery record deactivated.");
      recent.reload();
      loadStats();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const addButton = (
    <Link to="/admin/jewellery/new" className={buttonVariants({ size: "lg" })}>
      <Plus /> Add Jewellery
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={user ? `Signed in as ${user.name}.` : undefined}
        actions={addButton}
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, note }) => (
          <div key={key} className="bg-white px-5 py-5 sm:px-6">
            <p className="text-[13px] text-muted">{label}</p>
            {stats ? (
              <p className="tabular mt-2 text-[32px] font-medium leading-none text-emerald">{stats[key]}</p>
            ) : (
              <Skeleton className="mt-2 h-[34px] w-12" />
            )}
            <p className="mt-2 hidden text-xs text-muted sm:block">{note}</p>
          </div>
        ))}
      </div>

      <Panel className="mt-8">
        <PanelHeader
          title="Recent jewellery"
          description="The latest registered pieces."
          action={
            <Link to="/admin/jewellery" className="text-sm font-medium text-emerald underline-offset-4 hover:underline">
              View all
            </Link>
          }
        />
        {recent.error ? (
          <p className="px-6 py-10 text-center text-sm text-danger">{recent.error}</p>
        ) : !recent.loading && recent.data?.items.length === 0 ? (
          <EmptyState
            icon={Gem}
            title="No jewellery registered yet"
            description="Register your first piece to create its digital record and QR code."
            action={addButton}
          />
        ) : (
          <JewelleryTable
            items={recent.data?.items ?? []}
            loading={recent.loading && !recent.data}
            columns={["id", "type", "purity", "weight", "price", "status", "created"]}
            onDeactivate={deactivate}
          />
        )}
      </Panel>
    </>
  );
}
