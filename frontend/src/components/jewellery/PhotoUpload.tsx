import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MAX_CERTIFICATE_MB } from "./CertificateUpload";

const ACCEPT = ["image/jpeg", "image/png"];

export function validatePhoto(file: File): string | null {
  if (!ACCEPT.includes(file.type) || !/\.(jpe?g|png)$/i.test(file.name)) return "Choose a JPG or PNG photo.";
  if (file.size > MAX_CERTIFICATE_MB * 1024 * 1024) return `The photo is larger than ${MAX_CERTIFICATE_MB} MB.`;
  return null;
}

interface PhotoUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  /** The photo already on file, shown when no replacement is chosen. */
  existing?: { url: string | null; onRemove: () => void } | null;
}

/** Product photo shown to buyers next to the jewellery details. */
export function PhotoUpload({ file, onChange, existing }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | undefined) {
    if (!f) return;
    const problem = validatePhoto(f);
    setError(problem);
    if (!problem) onChange(f);
  }

  const shown = preview ?? existing?.url ?? null;
  const hasPhoto = Boolean(file || existing);

  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline justify-between text-[13px] font-medium text-ink">
        Product photo
        <span className="text-xs font-normal text-muted">Optional</span>
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-line-strong bg-white hover:border-basalt/50"
          aria-label={hasPhoto ? "Replace photo" : "Choose a photo"}
        >
          {shown ? (
            <img src={shown} alt="" className="size-full object-cover" />
          ) : hasPhoto ? (
            <span className="size-full animate-pulse bg-basalt-50" />
          ) : (
            <ImagePlus className="size-6 text-gold" strokeWidth={1.5} />
          )}
        </button>
        <div className="min-w-0 text-[13px]">
          <p className="text-muted">
            {file ? "Uploads when you save." : hasPhoto ? "Shown to buyers on the verification page." : `JPG or PNG, up to ${MAX_CERTIFICATE_MB} MB.`}
          </p>
          <div className="mt-1 flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-sm px-2 py-1 text-basalt hover:bg-white">
              {hasPhoto ? "Replace" : "Choose photo"}
            </button>
            {file ? (
              <button type="button" onClick={() => onChange(null)} className="rounded-sm px-2 py-1 text-muted hover:bg-white">
                Cancel
              </button>
            ) : (
              existing && (
                <button type="button" onClick={existing.onRemove} className="rounded-sm px-2 py-1 text-danger hover:bg-white">
                  Remove
                </button>
              )
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
