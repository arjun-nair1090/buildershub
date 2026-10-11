import { CheckCircle2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { JewelleryForm } from "@/components/jewellery/JewelleryForm";
import { savePiece } from "@/components/jewellery/savePiece";
import { QrPanel } from "@/components/jewellery/QrPanel";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useQrImage } from "@/hooks/useQrImage";
import type { Jewellery } from "@/types";
import { formatINRRange, formatPurity, formatWeight } from "@/utils/format";

function RegistrationSuccess({ item, onAnother }: { item: Jewellery; onAnother: () => void }) {
  const qr = useQrImage(item.jewellery_id);
  return (
    <Panel className="mx-auto max-w-4xl overflow-hidden">
      <div className="flex items-start gap-4 border-b border-line bg-basalt-50/60 px-6 py-6 sm:px-8">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-basalt" strokeWidth={1.75} />
        <div>
          <h1 className="font-display text-[26px] leading-tight text-basalt">Piece registered</h1>
          <p className="mt-1 text-[15px] text-muted">
            Add its photos and publish it from the record page. Its QR code starts working once it's published.
          </p>
        </div>
      </div>

      <div className="grid gap-10 px-6 py-8 sm:px-8 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">Jewellery ID</p>
          <p className="tabular mt-1 font-display text-[30px] tracking-[0.06em] text-ink">{item.jewellery_id}</p>
          <dl className="mt-6 divide-y divide-line border-y border-line text-[15px]">
            {[
              ["Title", item.title],
              ["Store", item.store.name],
              ["Purity", formatPurity(item.purity, item.purity_percent)],
              ["Net gold weight", formatWeight(item.net_weight)],
              ["Price now", formatINRRange(item.price.final_min, item.price.final_max)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="tabular text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link to={`/admin/jewellery/${item.jewellery_id}`} className={buttonVariants()}>
              Add photos and publish
            </Link>
            <Link to="/admin/jewellery" className={buttonVariants({ variant: "secondary" })}>
              Back to pieces
            </Link>
            <Button variant="ghost" onClick={onAnother}>
              <Plus /> Register another
            </Button>
          </div>
        </div>
        <QrPanel item={item} qr={qr} />
      </div>
    </Panel>
  );
}


export function AddJewelleryPage() {
  const [created, setCreated] = useState<Jewellery | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    document.title = created ? `${created.jewellery_id} registered` : "Add piece";
  }, [created]);

  if (created) {
    return (
      <RegistrationSuccess
        item={created}
        onAnother={() => {
          setCreated(null);
          setFormKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <>
      <PageHeader title="Add piece" description="Saving creates the piece's Jewellery ID, digital record and QR code." />
      <JewelleryForm
        key={formKey}
        submitLabel="Register piece"
        cancelTo="/admin/jewellery"
        canPublish={false}
        onSubmit={async (input, certificate) => {
          const { item, warning } = await savePiece(null, input, certificate, false);
          if (warning) toast.error(warning);
          toast.success("Piece registered.");
          setCreated(item);
          window.scrollTo({ top: 0 });
        }}
      />
    </>
  );
}
