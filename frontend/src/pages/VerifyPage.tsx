import { BadgeCheck, Info, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { HallmarkStamp } from "@/components/jewellery/HallmarkStamp";
import { PriceBreakdown } from "@/components/jewellery/PriceBreakdown";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordUnavailable } from "@/components/verify/RecordUnavailable";
import { ApiError, errorMessage } from "@/services/api";
import { verifyService } from "@/services/verify";
import type { PublicVerification } from "@/types";
import { formatDate, formatPurity, formatWeight } from "@/utils/format";

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

function ResultBanner({ record, checkedAt }: { record: PublicVerification; checkedAt: Date }) {
  const verified = record.verification_status === "VERIFIED";
  return (
    <div className="grain rise px-5 pb-7 pt-8 text-chalk sm:rounded-t-lg sm:px-8">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 animate-[strike_650ms_250ms_cubic-bezier(.22,1,.36,1)_both] place-items-center rounded-full border border-gold-bright/70 bg-gold-bright/10 text-gold-bright">
          {verified ? <BadgeCheck className="size-6" strokeWidth={1.5} /> : <ShieldCheck className="size-6" strokeWidth={1.5} />}
        </span>
        <h1 className="font-display text-[30px] leading-none sm:text-[36px]">
          {verified ? "Verified record" : "Registered record"}
        </h1>
      </div>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-chalk/85">
        This jewellery item is registered with Jewlerify.
        {!verified && " No certificate reference has been registered for it."}
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
    </div>
  );
}

function VerifiedRecord({ record, checkedAt }: { record: PublicVerification; checkedAt: Date }) {
  const verified = record.verification_status === "VERIFIED";
  return (
    <div className="mx-auto max-w-5xl sm:px-6 sm:py-10 lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-8">
      <article className="bg-white sm:rounded-lg sm:border sm:border-line sm:shadow-[0_30px_60px_-40px_rgba(21,25,27,0.45)]">
        <ResultBanner record={record} checkedAt={checkedAt} />

        <section className="rise flex items-start justify-between gap-4 px-5 py-7 sm:px-8" style={delay(150)}>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gold-deep">Jewellery details</p>
            <h2 className="mt-1.5 font-display text-[26px] leading-tight text-ink">{record.type}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">{record.description}</p>
          </div>
          <HallmarkStamp purity={record.purity} percent={record.purity_percent} size="lg" className="mt-1 shrink-0 animate-[strike_650ms_450ms_cubic-bezier(.22,1,.36,1)_both]" />
        </section>

        <Section title="Gold information" at={250}>
          <dl>
            <Row label="Purity" value={formatPurity(record.purity, record.purity_percent)} />
            <Row label="Gross weight" value={formatWeight(record.gross_weight)} />
            <Row label="Net gold weight" value={formatWeight(record.net_weight)} />
          </dl>
        </Section>

        <Section title="Certification" at={330}>
          {record.certificate_id ? (
            <dl>
              <Row label="Certificate ID" value={<span className="tracking-wide">{record.certificate_id}</span>} />
              <Row label="Issuing authority" value={record.issuing_authority ?? "Not recorded"} />
              <Row label="Certificate date" value={formatDate(record.certificate_date)} />
            </dl>
          ) : (
            <p className="text-[15px] text-muted">No certificate reference was registered for this item.</p>
          )}
        </Section>

        {/* On phones the price sits in the reading flow; on desktop it moves to the side column. */}
        <div className="lg:hidden">
          <Section title="Price transparency" at={410}>
            <PriceBreakdown {...record} emphasis stagger={500} />
          </Section>
        </div>

        <Section title="Verification status" at={490}>
          <dl>
            <Row
              label="Verification status"
              strong
              value={
                <span className="inline-flex items-center gap-1.5 text-verified">
                  {verified ? <BadgeCheck className="size-4" /> : <ShieldCheck className="size-4" />}
                  {verified ? "Verified" : "Registered"}
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

      <aside className="rise hidden lg:sticky lg:top-8 lg:block" style={delay(300)}>
        <div className="rounded-lg border border-line bg-white p-7 shadow-[0_30px_60px_-40px_rgba(21,25,27,0.45)]">
          <h2 className="text-[13px] font-semibold text-gold-deep">Price transparency</h2>
          <p className="mb-6 mt-1 text-sm text-muted">How the total price is made up.</p>
          <PriceBreakdown {...record} emphasis stagger={450} />
        </div>
        <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted">
          Amounts are as registered by the jeweller for this item, in Indian rupees.
        </p>
      </aside>

      <p className="px-5 py-8 text-center text-sm lg:col-span-2">
        <Link to="/verify" className="font-medium text-basalt underline-offset-4 hover:underline">
          Verify another item
        </Link>
      </p>
    </div>
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

  useEffect(() => {
    document.title =
      state.kind === "found"
        ? `${state.record.jewellery_id}, ${state.record.verification_status === "VERIFIED" ? "verified" : "registered"} record`
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
