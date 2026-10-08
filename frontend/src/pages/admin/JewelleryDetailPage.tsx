import { ArrowLeft, Download, FileText, PencilLine, Power, PowerOff, SearchX } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { HallmarkStamp } from "@/components/jewellery/HallmarkStamp";
import { PriceBreakdown } from "@/components/jewellery/PriceBreakdown";
import { QrPanel } from "@/components/jewellery/QrPanel";
import { StatusBadge, VerificationBadge } from "@/components/jewellery/StatusBadge";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DataRow, Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useJewelleryRecord } from "@/hooks/useJewellery";
import { useQrImage } from "@/hooks/useQrImage";
import { errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import { certificateFilename, saveBlob } from "@/utils/download";
import { formatDate, formatPurity, formatWeight } from "@/utils/format";

const backLink = (
  <Link to="/admin/jewellery" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
    <ArrowLeft className="size-4" /> All jewellery
  </Link>
);

export function RecordMissing({ id, message, onRetry }: { id: string; message?: string; onRetry?: () => void }) {
  return (
    <>
      {backLink}
      <Panel>
        <EmptyState
          icon={SearchX}
          title={message ? "The record could not be loaded" : `No record with ID ${id}`}
          description={message ?? "Check the Jewellery ID, or find the piece in the jewellery list."}
          action={
            onRetry ? (
              <Button variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            ) : (
              <Link to="/admin/jewellery" className={buttonVariants({ variant: "secondary" })}>
                Go to jewellery list
              </Link>
            )
          }
        />
      </Panel>
    </>
  );
}

function InfoCard({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Panel>
      <PanelHeader title={title} action={aside} />
      <div className="px-5 py-3 sm:px-6">{children}</div>
    </Panel>
  );
}

export function JewelleryDetailPage() {
  const { id = "" } = useParams();
  const { item, setItem, error, notFound, loading, reload } = useJewelleryRecord(id);
  const qr = useQrImage(item?.jewellery_id);

  useEffect(() => {
    document.title = id;
  }, [id]);

  if (notFound) return <RecordMissing id={id} />;
  if (error) return <RecordMissing id={id} message={error} onRetry={reload} />;

  if (loading || !item) {
    return (
      <>
        <PageHeader back={backLink} title={<Skeleton className="h-9 w-56" />} />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Panel key={i} className="space-y-3 p-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </Panel>
            ))}
          </div>
          <Panel className="p-6">
            <Skeleton className="aspect-square w-full" />
          </Panel>
        </div>
      </>
    );
  }

  async function deactivate() {
    try {
      setItem(await jewelleryService.deactivate(item!.jewellery_id));
      toast.success("Jewellery record deactivated.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function activate() {
    try {
      setItem(await jewelleryService.activate(item!.jewellery_id));
      toast.success("Jewellery record reactivated.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function downloadCertificate() {
    try {
      const blob = await jewelleryService.downloadCertificate(item!.jewellery_id);
      saveBlob(blob, certificateFilename(item!.jewellery_id, blob));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const active = item.status === "active";

  return (
    <>
      <PageHeader
        back={backLink}
        title={<span className="tabular tracking-[0.04em]">{item.jewellery_id}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <VerificationBadge status={item.verification_status} />
            <span className="text-[13px]">Registered {formatDate(item.created_at)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={qr.download} disabled={!qr.url}>
              <Download /> Download QR
            </Button>
            <Link to={`/admin/jewellery/${item.jewellery_id}/edit`} className={buttonVariants({ variant: "secondary" })}>
              <PencilLine /> Edit
            </Link>
            {active ? (
              <ConfirmDialog
                title={`Deactivate ${item.jewellery_id}?`}
                description="Its QR code will stop verifying and buyers will see that the record is inactive. You can reactivate it later."
                confirmLabel="Deactivate"
                onConfirm={deactivate}
                trigger={
                  <Button variant="danger-outline">
                    <PowerOff /> Deactivate
                  </Button>
                }
              />
            ) : (
              <ConfirmDialog
                title={`Reactivate ${item.jewellery_id}?`}
                description="Its QR code will open the verification page again."
                confirmLabel="Reactivate"
                tone="primary"
                onConfirm={activate}
                trigger={
                  <Button variant="secondary">
                    <Power /> Reactivate
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6 md:grid-cols-2">
          <InfoCard title="Jewellery information">
            <dl className="divide-y divide-line">
              <DataRow label="Type" value={item.type} />
              <div className="py-2.5">
                <dt className="text-[13px] text-muted">Description</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-ink">{item.description}</dd>
              </div>
            </dl>
          </InfoCard>

          <InfoCard title="Gold information" aside={<HallmarkStamp purity={item.purity} percent={item.purity_percent} />}>
            <dl className="divide-y divide-line">
              <DataRow label="Purity" value={formatPurity(item.purity, item.purity_percent)} mono />
              <DataRow label="Gross weight" value={formatWeight(item.gross_weight)} mono />
              <DataRow label="Net weight" value={formatWeight(item.net_weight)} mono />
            </dl>
          </InfoCard>

          <InfoCard title="Certification">
            {item.certificate_id ? (
              <dl className="divide-y divide-line">
                <DataRow label="Certificate ID" value={item.certificate_id} mono />
                <DataRow label="Issuing authority" value={item.issuing_authority ?? "—"} />
                <DataRow label="Certificate date" value={formatDate(item.certificate_date)} />
                <DataRow
                  label="Document"
                  value={
                    item.has_certificate_document ? (
                      <button type="button" onClick={downloadCertificate} className="inline-flex items-center gap-1.5 text-basalt hover:underline">
                        <FileText className="size-4" /> Download
                      </button>
                    ) : (
                      <span className="text-muted">Not uploaded</span>
                    )
                  }
                />
              </dl>
            ) : (
              <p className="py-3 text-sm text-muted">
                No certificate reference. Buyers see this record as registered rather than verified.{" "}
                <Link to={`/admin/jewellery/${item.jewellery_id}/edit`} className="text-basalt hover:underline">
                  Add certificate details
                </Link>
              </p>
            )}
          </InfoCard>

          <InfoCard title="Price transparency">
            <PriceBreakdown {...item} className="py-3" />
          </InfoCard>
        </div>

        <Panel className="lg:sticky lg:top-8">
          <PanelHeader title="QR code" description="Opens the public verification page." />
          <QrPanel item={item} qr={qr} className="p-5" />
        </Panel>
      </div>
    </>
  );
}
