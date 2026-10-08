import { Download, ExternalLink, QrCode } from "lucide-react";
import type { useQrImage } from "@/hooks/useQrImage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Jewellery } from "@/types";
import { cn } from "@/utils/cn";

interface QrPanelProps {
  item: Pick<Jewellery, "jewellery_id" | "verification_token" | "verification_url" | "status">;
  qr: ReturnType<typeof useQrImage>;
  className?: string;
}

export function QrPanel({ item, qr, className }: QrPanelProps) {
  const { url, error, loading, download } = qr;
  const inactive = item.status !== "active";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-full max-w-[260px] rounded-md border border-line bg-white p-3">
        {loading && <Skeleton className="aspect-[1189/1426] w-full" />}
        {error && (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <QrCode className="size-6 text-gold" strokeWidth={1.5} />
            {error}
          </div>
        )}
        {url && (
          <img
            src={url}
            alt={`QR code for ${item.jewellery_id}`}
            className={cn("w-full", inactive && "opacity-40 grayscale")}
          />
        )}
        {inactive && url && (
          <span className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-sm border border-line-strong bg-white/95 px-3 py-2 text-center text-xs text-muted">
            Record inactive. This QR code no longer verifies.
          </span>
        )}
      </div>

      <p className="mt-3 max-w-[260px] break-all text-center text-xs text-muted">{item.verification_url}</p>

      <div className="mt-4 flex w-full max-w-[260px] flex-col gap-2">
        <Button onClick={download} disabled={!url}>
          <Download /> Download QR
        </Button>
        <a
          href={`/verify/${item.verification_token}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line-strong bg-white text-sm font-medium text-ink transition-colors hover:bg-basalt-50 [&_svg]:size-4"
        >
          <ExternalLink /> View verification page
        </a>
      </div>
    </div>
  );
}
