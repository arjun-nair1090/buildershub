import { ArrowRight, Info } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Gallery } from "@/components/public/Gallery";
import { SaveButton } from "@/components/public/SaveButton";
import { Unavailable } from "@/components/public/Unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicRecord } from "@/hooks/usePublicRecord";
import { publicService } from "@/services/public";
import type { PublicDesign } from "@/types";
import { formatDaysRange, formatINRRange, formatWeightRange } from "@/utils/format";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-line py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular text-right text-[15px] text-ink">{value}</dd>
    </div>
  );
}

/** Made to order: everything reads "approx", and there's no badge, Jewellery ID or price breakdown. */
function DesignView({ design }: { design: PublicDesign }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-10">
      <Gallery className="rise" photos={design.photos} sizes="(min-width: 1024px) 520px, 100vw" />

      <div className="rise mt-8 lg:mt-0">
        <span className="inline-flex rounded-full bg-gold-bright px-2.5 py-0.5 text-xs font-semibold text-basalt">Made to order</span>
        <div className="mt-3 flex items-start gap-3">
          <h1 className="min-w-0 break-words font-display text-[32px] leading-tight text-ink sm:text-[38px]">{design.title}</h1>
          <SaveButton kind="design" id={design.public_id} title={design.title} variant="inline" className="mt-1" />
        </div>
        <p className="mt-1 text-[15px] text-muted">{design.category}</p>

        <p className="mt-6 text-[13px] text-muted">Approximate price</p>
        <p className="tabular font-display text-[28px] leading-tight text-ink">
          approx {formatINRRange(design.price_min, design.price_max)}
        </p>

        <dl className="mt-6">
          <Row label="Weight" value={`approx ${formatWeightRange(design.weight_min, design.weight_max)}`} />
          <Row label="Purity" value={design.purity_options.join(" / ")} />
          <Row label="Making time" value={formatDaysRange(design.making_days_min, design.making_days_max)} />
        </dl>

        {design.description && <p className="mt-5 text-[15px] leading-relaxed text-ink/85">{design.description}</p>}

        <p className="mt-5 flex gap-2.5 rounded-md border border-line bg-white px-4 py-3 text-[13px] leading-relaxed text-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.75} aria-hidden />
          Approximate price. Final price agreed with the store.
        </p>

        <Link
          to={`/stores/${design.store.slug}`}
          className="group mt-6 flex items-center justify-between gap-4 rounded-lg border border-line bg-white px-5 py-4 transition-colors hover:border-gold/40"
        >
          <span className="min-w-0">
            <span className="block text-[13px] text-muted">Made by</span>
            <span className="block truncate text-[17px] font-medium text-ink">{design.store.name}</span>
            <span className="block text-[13px] text-muted">
              {design.store.area}, {design.store.city}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function DesignSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[1fr_400px] lg:gap-10" role="status" aria-label="Loading the design">
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="mt-8 space-y-4 lg:mt-0">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-56" />
      </div>
    </div>
  );
}

export function DesignPage() {
  const { id = "" } = useParams();
  const { state, retry } = usePublicRecord(id, (signal) => publicService.design(id, signal));

  useEffect(() => {
    document.title = state.kind === "found" ? `${state.data.title}, made to order` : "Design";
  }, [state]);

  switch (state.kind) {
    case "loading":
      return <DesignSkeleton />;
    case "found":
      return <DesignView design={state.data} />;
    case "not-found":
      return <Unavailable title="Design not found" body="There's no design at this address. Check the link and try again." />;
    case "gone":
      return <Unavailable title="This design is no longer available" body="The store that makes it is no longer listed on Jewlerify." />;
    case "error":
      return <Unavailable title="The design could not be loaded" body={state.message} onRetry={retry} />;
  }
}
