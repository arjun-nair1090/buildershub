import { FileText, Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export const MAX_CERTIFICATE_MB = 5;
const ACCEPT = ["application/pdf", "image/jpeg", "image/png"];

export function validateCertificate(file: File): string | null {
  if (!ACCEPT.includes(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    return "Choose a PDF, JPG or PNG file.";
  }
  if (file.size > MAX_CERTIFICATE_MB * 1024 * 1024) {
    return `The file is larger than ${MAX_CERTIFICATE_MB} MB.`;
  }
  return null;
}

interface CertificateUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Shown when a document is already on file and no replacement is chosen. */
  existing?: { onDownload: () => void; onRemove: () => void } | null;
}

export function CertificateUpload({ file, onChange, existing }: CertificateUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function pick(f: File | undefined) {
    if (!f) return;
    const problem = validateCertificate(f);
    setError(problem);
    if (!problem) onChange(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  }

  const row = (name: string, meta: string, actions: ReactNode) => (
    <div className="flex items-center gap-3 rounded-md border border-line bg-ivory px-3 py-2.5">
      <FileText className="size-5 shrink-0 text-gold" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-charcoal">{name}</p>
        <p className="text-xs text-muted">{meta}</p>
      </div>
      {actions}
    </div>
  );

  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline justify-between text-[13px] font-medium text-charcoal">
        Certificate document
        <span className="text-xs font-normal text-muted">Optional</span>
      </p>

      {file ? (
        row(
          file.name,
          `${(file.size / 1024 / 1024).toFixed(2)} MB, uploads when you save`,
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-sm p-1 text-muted hover:bg-white hover:text-charcoal"
            aria-label="Remove selected file"
          >
            <X className="size-4" />
          </button>,
        )
      ) : existing ? (
        row(
          "Certificate on file",
          "PDF or image uploaded earlier",
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={existing.onDownload} className="rounded-sm px-2 py-1 text-[13px] text-emerald hover:bg-white">
              Download
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-sm px-2 py-1 text-[13px] text-emerald hover:bg-white">
              Replace
            </button>
            <button type="button" onClick={existing.onRemove} className="rounded-sm px-2 py-1 text-[13px] text-danger hover:bg-white">
              Remove
            </button>
          </div>,
        )
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex w-full flex-col items-center rounded-md border border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-emerald bg-emerald-50" : "border-line-strong bg-white hover:border-emerald/50",
          )}
        >
          <Upload className="mb-2 size-5 text-gold" strokeWidth={1.5} />
          <span className="text-sm font-medium text-charcoal">Choose a file or drop it here</span>
          <span className="mt-0.5 text-xs text-muted">PDF, JPG or PNG, up to {MAX_CERTIFICATE_MB} MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
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
