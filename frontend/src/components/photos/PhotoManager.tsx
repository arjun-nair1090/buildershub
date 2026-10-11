import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useAdminImage } from "@/hooks/useAdminImage";
import { errorMessage } from "@/services/api";
import { photoService } from "@/services/photos";
import type { Photo, PhotoOwner } from "@/types";

export const MAX_PHOTOS = 6;

interface PhotoManagerProps {
  owner: PhotoOwner;
  /** Store slug, Jewellery ID or design ID. */
  ownerKey: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  hint?: string;
}

function Thumb({ photo }: { photo: Photo }) {
  const url = useAdminImage(photo.public_id, "thumb");
  return url ? (
    <img src={url} alt={photo.alt} className="aspect-square w-full rounded-md border border-line object-cover" />
  ) : (
    <div className="aspect-square w-full animate-pulse rounded-md bg-basalt-50" aria-hidden />
  );
}

/** Upload, order, describe and delete up to six photos. The first photo is the cover. */
export function PhotoManager({ owner, ownerKey, photos, onChange, hint }: PhotoManagerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<Photo[]>, success?: string) {
    setBusy(true);
    try {
      onChange(await action());
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, by: -1 | 1) {
    const ids = photos.map((p) => p.public_id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    void run(() => photoService.reorder(owner, ownerKey, ids));
  }

  async function upload(files: FileList | null) {
    const picked = Array.from(files ?? []).slice(0, MAX_PHOTOS - photos.length);
    for (const file of picked) {
      await run(() => photoService.upload(owner, ownerKey, file));
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-4">
      {hint && <p className="text-[13px] leading-relaxed text-muted">{hint}</p>}

      {photos.length > 0 && (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, i) => (
            <li key={photo.public_id} className="space-y-2 rounded-md border border-line p-3">
              <Thumb photo={photo} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{i === 0 ? "Cover photo" : `Photo ${i + 1}`}</span>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label={`Move photo ${i + 1} earlier`} disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Move photo ${i + 1} later`} disabled={busy || i === photos.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <ConfirmDialog
                    title="Delete this photo?"
                    description="It's removed straight away, everywhere it appears."
                    confirmLabel="Delete photo"
                    onConfirm={() => run(() => photoService.remove(photo.public_id), "Photo deleted.")}
                    trigger={
                      <Button size="icon" variant="ghost" aria-label={`Delete photo ${i + 1}`} disabled={busy}>
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              </div>
              <Input
                aria-label={`Alt text for photo ${i + 1}`}
                placeholder={`Alt text (default: ${photo.alt})`}
                defaultValue={photo.alt_text}
                maxLength={200}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value !== photo.alt_text) void run(() => photoService.updateAlt(photo.public_id, value));
                }}
              />
            </li>
          ))}
        </ol>
      )}

      {photos.length < MAX_PHOTOS && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void upload(e.target.files)}
          />
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            <ImagePlus /> Add photos
          </Button>
          <span className="text-xs text-muted">
            JPG or PNG, up to 4 MB each · {MAX_PHOTOS - photos.length} more allowed
          </span>
        </div>
      )}
    </div>
  );
}
