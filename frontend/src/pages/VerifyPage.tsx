import { BadgeCheck, Info, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { HallmarkStamp } from "@/components/jewellery/HallmarkStamp";
import { PriceBreakdown } from "@/components/jewellery/PriceBreakdown";
import { Gallery } from "@/components/public/Gallery";
import { PieceTile } from "@/components/public/PieceTile";
import { SaveButton } from "@/components/public/SaveButton";
import { Skeleton } from "@/components/ui/skeleton";
import { GoldRateTape, GoldRateTicker } from "@/components/verify/GoldRateTicker";
import { RecordUnavailable } from "@/components/verify/RecordUnavailable";
import { ApiError, errorMessage } from "@/services/api";
import { verifyService } from "@/services/verify";
import { STOCK_LABEL, VERIFICATION_LABEL, type PublicVerification, type VerificationLevel } from "@/types";
import { formatDate, formatPurity, formatWeight } from "@/utils/format";

/** How often an open page re-checks the record, so the live price follows the gold rate. */
const REFRESH_MS = 60_000;

type State =
  | { kind: "loading" }
  | { kind: "found"; record: PublicVerification; checkedAt: Date }
  | { kind: "not-found" }
  | { kind: "inactive" }
  | { kind: "error"; message: string };

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** `at` is when the section rises in, so the record reads top to bottom as it appears. */
function Section({ title, at, children }: { title: string; at: number; children: ReactNode }) {
  return (
    <section className="rise border-t border-line px-5 py-6 sm:px-8" style={delay(at)}>
      <h2 className="mb-3 text-[13px] font-semibold text-gold-deep">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={strong ? "tabular text-right text-[15px] font-semibold text-ink" : "tabular text-right text-[15px] text-ink"}>
        {value}
      </dd>
    </div>
  );
}

function LevelIcon({ level, className }: { level: VerificationLevel; className?: string }) {
  const Icon = level === "declared" ? ShieldCheck : BadgeCheck;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}

/** One line on what the level means, so "Declared by store" can't be mistaken for verified. */
function levelSummary(record: PublicVerification): string {
  switch (record.verification_level) {
    case "lab":
      return "Backed by a lab certificate, shown below.";
    case "hallmark":
      return `Linked to BIS hallmark HUID ${record.huid}.`;
    case "declared":
      return "These details are as declared by the store. No hallmark or certificate is linked to this record.";
  }
}

function ResultBanner({ record, checkedAt }: { record: PublicVerification; checkedAt: Date }) {
  return (
    <div className="grain rise relative px-5 pb-16 pt-8 text-chalk sm:rounded-t-lg sm:px-8">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 animate-[strike_650ms_250ms_cubic-bezier(.22,1,.36,1)_both] place-items-center rounded-full border border-gold-bright/70 bg-gold-bright/10 text-gold-bright">
          <LevelIcon level={record.verification_level} className="size-6" />
        </span>
        <h1 className="font-display text-[30px] leading-none sm:text-[36px]">{VERIFICATION_LABEL[record.verification_level]}</h1>
      </div>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-chalk/85">
        Listed on Jewlerify by {record.store.name}, {record.store.area}. {levelSummary(record)}
      </p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-white/15 pt-4">
        <div>
          <p className="text-xs text-chalk/60">Jewellery ID</p>
          <p className="tabular mt-0.5 text-lg font-medium tracking-[0.08em]">{record.jewellery_id}</p>
        </div>
        <p className="text-xs text-chalk/60">
          Checked {checkedAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      {/* A tab of the white card reaching up into the banner: whose piece this is. */}
      <p className="absolute bottom-0 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-t-lg bg-white px-4 pb-1 pt-3 font-display text-[24px] leading-tight text-ink sm:left-6">
        <span className="sr-only">Store: </span>
        <Link to={`/stores/${record.store.slug}`} className="underline-offset-4 hover:underline">
          {record.store.name}
        </Link>
      </p>
    </div>
  );
}

function PriceNote({ record }: { record: PublicVerification }) {
  return record.price.basis === "live" ? (
    <>Gold value at today's market rate; making charges and tax as the range this store charges.</>
  ) : (
    <>The live gold rate isn't available right now, so this is the price as registered by the store.</>
  );
}

function VerifiedRecord({ record, checkedAt }: { record: PublicVerification; checkedAt: Date }) {
  const hasDesign = Boolean(record.colour || record.design_details);
  return (
    // overflow-x-clip: the moving gold rate tape otherwise made phones zoom out slightly to fit it.
    <div className="mx-auto max-w-5xl overflow-x-clip sm:px-6 sm:py-10 lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-8">
      <article className="bg-white sm:rounded-lg sm:border sm:border-line sm:shadow-[0_30px_60px_-40px_rgba(21,25,27,0.45)]">
        <ResultBanner record={record} checkedAt={checkedAt} />

        {record.photos.length > 0 && (
          <div className="rise px-5 pt-7 sm:px-8" style={delay(120)}>
            <Gallery photos={record.photos} sizes="(min-width: 1024px) 520px, (min-width: 640px) 560px, 100vw" />
          </div>
        )}

        <section className="rise flex items-start justify-between gap-4 px-5 py-7 sm:px-8" style={delay(150)}>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gold-deep">Jewellery details</p>
            <div className="mt-1.5 flex items-start gap-3">
              <h2 className="min-w-0 font-display text-[26px] leading-tight text-ink">{record.title}</h2>
              <SaveButton kind="piece" id={record.jewellery_id} title={record.title} variant="inline" />
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
              {record.type} · {record.description}
            </p>
            {record.stock_status !== "in_stock" && (
              <span className="mt-3 inline-flex rounded-full border border-line-strong bg-chalk px-2.5 py-0.5 text-xs font-semibold text-ink">
                {STOCK_LABEL[record.stock_status]}
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-3">
            <HallmarkStamp purity={record.purity} percent={record.purity_percent} size="lg" className="mt-1 animate-[strike_650ms_450ms_cubic-bezier(.22,1,.36,1)_both]" />
          </div>
        </section>

        <Section title="Gold information" at={250}>
          <dl>
            <Row label="Purity" value={formatPurity(record.purity, record.purity_percent)} />
            <Row label="Gross weight" value={formatWeight(record.gross_weight)} />
            <Row label="Net gold weight" value={formatWeight(record.net_weight)} />
          </dl>
        </Section>

        {hasDesign && (
          <Section title="Design" at={290}>
            <dl>
              {record.colour && <Row label="Colour" value={record.colour} />}
              {record.design_details && (
                <div className="py-2">
                  <dt className="text-sm text-muted">Design details</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-ink">{record.design_details}</dd>
                </div>
              )}
            </dl>
          </Section>
        )}

        <Section title="Verification" at={330}>
          <dl>
            <Row
              label="Level"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <LevelIcon level={record.verification_level} className="size-4 text-gold-deep" />
                  {VERIFICATION_LABEL[record.verification_level]}
                </span>
              }
            />
            {record.huid && <Row label="Hallmark HUID" value={<span className="tracking-[0.15em]">{record.huid}</span>} />}
            {record.certificate_id && (
              <>
                <Row label="Certificate ID" value={<span className="tracking-wide">{record.certificate_id}</span>} />
                <Row label="Issuing authority" value={record.issuing_authority ?? "Not recorded"} />
                <Row label="Certificate date" value={formatDate(record.certificate_date)} />
              </>
            )}
          </dl>
          {record.verification_level === "declared" && (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">Ask the store to show you the hallmark when you visit.</p>
          )}
        </Section>

        {/* On phones the rate and price sit in the reading flow; on desktop they move to the side column. */}
        <div className="lg:hidden">
          {record.gold_rate && (
            <Section title="Live gold rate" at={370}>
              <GoldRateTicker rate={record.gold_rate} highlight={record.purity} />
            </Section>
          )}
          <Section title="Price transparency" at={410}>
            <PriceBreakdown price={record.price} emphasis stagger={500} />
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              <PriceNote record={record} />
            </p>
          </Section>
        </div>

        <Section title="Verification status" at={490}>
          <dl>
            <Row
              label="Verification level"
              strong
              value={
                <span className="inline-flex items-center gap-1.5 text-verified">
                  <LevelIcon level={record.verification_level} className="size-4" />
                  {VERIFICATION_LABEL[record.verification_level]}
                </span>
              }
            />
            <Row label="Record status" strong value="Active" />
            <Row label="Registered on" value={formatDate(record.registered_on)} />
          </dl>
        </Section>

        <div className="rise flex gap-3 border-t border-line bg-chalk/60 px-5 py-5 text-[13px] leading-relaxed text-muted sm:rounded-b-lg sm:px-8" style={delay(570)}>
          <Info className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.75} />
          <p>
            This page verifies the information associated with the registered digital record. It does not independently
            perform physical testing of the jewellery.
          </p>
        </div>
      </article>

      <aside className="rise hidden space-y-5 lg:sticky lg:top-8 lg:block" style={delay(300)}>
        {record.gold_rate && (
          <div className="rounded-lg border border-line bg-white p-7 shadow-[0_30px_60px_-40px_rgba(21,25,27,0.45)]">
            <h2 className="mb-4 text-[13px] font-semibold text-gold-deep">Live gold rate</h2>
            <GoldRateTicker rate={record.gold_rate} highlight={record.purity} />
          </div>
        )}
        <div className="rounded-lg border border-line bg-white p-7 shadow-[0_30px_60px_-40px_rgba(21,25,27,0.45)]">
          <h2 className="text-[13px] font-semibold text-gold-deep">Price transparency</h2>
          <p className="mb-6 mt-1 text-sm text-muted">How the price is made up.</p>
          <PriceBreakdown price={record.price} emphasis stagger={450} />
        </div>
        <p className="px-1 text-[13px] leading-relaxed text-muted">
          <PriceNote record={record} />
        </p>
      </aside>

      {record.gold_rate && (
        <div className="rise mt-6 lg:col-span-2 lg:mt-0" style={delay(620)}>
          <GoldRateTape rate={record.gold_rate} />
        </div>
      )}

      <SimilarPieces record={record} />

      <p className="px-5 py-8 text-center text-sm lg:col-span-2">
        <Link to="/verify" className="font-medium text-basalt underline-offset-4 hover:underline">
          Verify another item
        </Link>
      </p>
    </div>
  );
}

/** Same store only. A scroller on phones, a grid on desktop. Not rendered when there are none. */
function SimilarPieces({ record }: { record: PublicVerification }) {
  if (record.similar.length === 0) return null;
  return (
    <section className="rise mt-10 lg:col-span-2" style={delay(660)} aria-labelledby="similar-heading">
      <div className="px-5 sm:px-0">
        <h2 id="similar-heading" className="font-display text-[24px] leading-tight text-ink">Similar pieces</h2>
        <p className="mt-1 text-sm text-muted">More from {record.store.name}</p>
      </div>
      <div className="mt-5 flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:scroll-px-0 [scrollbar-width:none] sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {record.similar.map((piece) => (
          <div key={piece.jewellery_id} className="w-40 shrink-0 snap-start sm:w-48 lg:w-auto">
            <PieceTile piece={piece} />
          </div>
        ))}
      </div>
    </section>
  );
}

function VerifySkeleton() {
  return (
    <div className="mx-auto max-w-5xl sm:px-6 sm:py-10" role="status" aria-label="Checking the record">
      <div className="bg-white sm:rounded-lg sm:border sm:border-line lg:max-w-[calc(100%-412px)]">
        <div className="space-y-4 bg-basalt px-5 py-8 sm:rounded-t-lg sm:px-8">
          <Skeleton className="h-8 w-56 bg-white/15" />
          <Skeleton className="h-4 w-72 bg-white/10" />
          <Skeleton className="mt-6 h-5 w-40 bg-white/15" />
        </div>
        <div className="space-y-3 px-5 py-7 sm:px-8">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3 border-t border-line px-5 py-6 sm:px-8">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerifyPage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(
    (signal?: AbortSignal) => {
      setState({ kind: "loading" });
      verifyService
        .verify(token, signal)
        .then((record) => setState({ kind: "found", record, checkedAt: new Date() }))
        .catch((err) => {
          if ((err as Error).name === "AbortError") return;
          if (err instanceof ApiError && (err.status === 404 || err.status === 422)) setState({ kind: "not-found" });
          else if (err instanceof ApiError && err.status === 410) setState({ kind: "inactive" });
          else setState({ kind: "error", message: errorMessage(err, "Check your connection and try again.") });
        });
    },
    [token],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Quiet refresh while the page is open: no skeleton, and a failed refresh keeps what's on screen.
  const found = state.kind === "found";
  useEffect(() => {
    if (!found) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      verifyService
        .verify(token)
        .then((record) => setState({ kind: "found", record, checkedAt: new Date() }))
        .catch(() => {});
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [found, token]);

  useEffect(() => {
    document.title =
      state.kind === "found"
        ? `${state.record.jewellery_id}, ${VERIFICATION_LABEL[state.record.verification_level].toLowerCase()}`
        : "Jewellery verification";
  }, [state]);

  switch (state.kind) {
    case "loading":
      return <VerifySkeleton />;
    case "found":
      return <VerifiedRecord record={state.record} checkedAt={state.checkedAt} />;
    case "not-found":
      return <RecordUnavailable kind="not-found" />;
    case "inactive":
      return <RecordUnavailable kind="inactive" />;
    case "error":
      return <RecordUnavailable kind="error" message={state.message} onRetry={() => load()} />;
  }
}
