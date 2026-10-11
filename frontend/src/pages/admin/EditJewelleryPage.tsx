import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { JewelleryForm } from "@/components/jewellery/JewelleryForm";
import { toFormValues } from "@/components/jewellery/jewellerySchema";
import { StatusBadge } from "@/components/jewellery/StatusBadge";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useJewelleryRecord } from "@/hooks/useJewellery";
import { usePhoto } from "@/hooks/usePhoto";
import { errorMessage } from "@/services/api";
import { jewelleryService } from "@/services/jewellery";
import { certificateFilename, saveBlob } from "@/utils/download";
import { RecordMissing } from "./JewelleryDetailPage";

export function EditJewelleryPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { item, setItem, error, notFound, loading, reload } = useJewelleryRecord(id);
  const photoUrl = usePhoto(item?.jewellery_id, item?.has_photo);

  useEffect(() => {
    document.title = `Edit ${id}`;
  }, [id]);

  if (notFound) return <RecordMissing id={id} />;
  if (error) return <RecordMissing id={id} message={error} onRetry={reload} />;

  const back = (
    <Link to={`/admin/jewellery/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft className="size-4" /> Back to record
    </Link>
  );

  if (loading || !item) {
    return (
      <>
        <PageHeader back={back} title={<Skeleton className="h-9 w-64" />} />
        <div className="space-y-5">
          {[0, 1, 2].map((i) => (
            <Panel key={i} className="space-y-4 p-8">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </Panel>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        back={back}
        title={`Edit ${item.jewellery_id}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} /> The QR code stays the same after editing.
          </span>
        }
      />
      <JewelleryForm
        defaultValues={toFormValues(item)}
        submitLabel="Save changes"
        cancelTo={`/admin/jewellery/${item.jewellery_id}`}
        existingDocument={
          item.has_certificate_document
            ? {
                onDownload: () =>
                  jewelleryService
                    .downloadCertificate(item.jewellery_id)
                    .then((blob) => saveBlob(blob, certificateFilename(item.jewellery_id, blob)))
                    .catch((err) => toast.error(errorMessage(err))),
                onRemove: () =>
                  jewelleryService
                    .removeCertificate(item.jewellery_id)
                    .then((updated) => {
                      setItem(updated);
                      toast.success("Certificate document removed.");
                    })
                    .catch((err) => toast.error(errorMessage(err))),
              }
            : null
        }
        existingPhoto={
          item.has_photo
            ? {
                url: photoUrl,
                onRemove: () =>
                  jewelleryService
                    .removePhoto(item.jewellery_id)
                    .then((updated) => {
                      setItem(updated);
                      toast.success("Photo removed.");
                    })
                    .catch((err) => toast.error(errorMessage(err))),
              }
            : null
        }
        onSubmit={async (input, certificate, photo) => {
          await jewelleryService.update(item.jewellery_id, input);
          if (certificate) {
            try {
              await jewelleryService.uploadCertificate(item.jewellery_id, certificate);
            } catch (err) {
              toast.error(`Changes saved, but the certificate didn't upload: ${errorMessage(err)}`);
            }
          }
          if (photo) {
            try {
              await jewelleryService.uploadPhoto(item.jewellery_id, photo);
            } catch (err) {
              toast.error(`Changes saved, but the photo didn't upload: ${errorMessage(err)}`);
            }
          }
          toast.success("Changes saved successfully.");
          navigate(`/admin/jewellery/${item.jewellery_id}`);
        }}
      />
    </>
  );
}
