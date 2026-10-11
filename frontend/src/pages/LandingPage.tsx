import { Camera, ListOrdered, ScanLine, ShieldOff } from "lucide-react";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { HallmarkStamp } from "@/components/jewellery/HallmarkStamp";
import { PriceBreakdown } from "@/components/jewellery/PriceBreakdown";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { buttonVariants } from "@/components/ui/button";
import { CodeEntryForm } from "@/components/verify/CodeEntryForm";
import type { PiecePrice } from "@/types";
import { cn } from "@/utils/cn";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** The landing page's worked example: the same breakdown a buyer sees, with a 5% offer. */
const EXAMPLE_PRICE: PiecePrice = {
  basis: "live",
  as_of: "2026-10-11T05:00:00Z",
  rate_per_gram: "13688",
  gold: "98500",
  making_min: "12000",
  making_max: "12000",
  making_percent_min: null,
  making_percent_max: null,
  other: "4000",
  gst_percent: "3",
  tax_min: "10500",
  tax_max: "10500",
  original_min: "125000",
  original_max: "125000",
  discount: { type: "percent", value: "5", label: "5% off", amount_min: "6250", amount_max: "6250", ends_on: null },
  final_min: "118750",
  final_max: "118750",
};

function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="max-w-xl">
      <h2 className="font-display text-[32px] leading-[1.08] text-basalt sm:text-[44px]">{title}</h2>
      {children && <p className="mt-4 text-[17px] leading-relaxed text-ink/75">{children}</p>}
    </div>
  );
}

const STEPS = [
  { title: "Register", body: "The jeweller records the piece once. It gets its own Jewellery ID and QR tag." },
  { title: "Scan", body: "Point any phone camera at the tag. The record opens in the browser." },
  { title: "Verify", body: "Read the registered purity, weights, certificate and itemised price." },
];

const VERIFIABLE = [
  { label: "Jewellery ID", detail: "The unique code given to this piece at registration." },
  { label: "Gold purity", detail: "Karat and fineness, e.g. 22K / 91.6%." },
  { label: "Weight", detail: "Gross weight and net gold weight, in grams." },
  { label: "Certificate reference", detail: "Certificate ID, issuing authority and date." },
  { label: "Price breakdown", detail: "Gold, making, stones and tax, itemised." },
  { label: "Verification status", detail: "Whether the record is active and verified." },
];

const REASONS = [
  {
    icon: Camera,
    title: "Nothing to install",
    body: "Any phone camera opens the record in the browser. No app, no account.",
  },
  {
    icon: ListOrdered,
    title: "Itemised, not bundled",
    body: "See what you are paying for gold, making, stones and tax as separate amounts.",
  },
  {
    icon: ScanLine,
    title: "One code, one piece",
    body: "Each QR points to a single registered item, so the details on screen belong to the piece in your hand.",
  },
  {
    icon: ShieldOff,
    title: "Withdrawn records say so",
    body: "If a jeweller deactivates a record, its QR stops showing it as verified.",
  },
];

export function LandingPage() {
  useEffect(() => {
    document.title = "Jewlerify: every jewel, verified";
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-basalt text-chalk">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1fr_minmax(0,540px)] lg:gap-12 lg:pb-28">
          <div className="max-w-xl">
            <h1 className="rise font-display text-[52px] leading-[0.98] sm:text-[76px] lg:text-[88px]">
              Every jewel, verified.
            </h1>
            <p className="rise mt-7 max-w-md text-lg leading-relaxed text-chalk/75" style={delay(140)}>
              Scan the tag on any piece to see its registered purity, weight, certificate and an itemised price,
              before you pay.
            </p>
            <div className="rise mt-10 flex flex-col gap-3 sm:flex-row" style={delay(260)}>
              <Link to="/verify" className={cn(buttonVariants({ size: "lg", variant: "gold" }))}>
                Verify jewellery
              </Link>
              <Link
                to="/admin/login"
                className={cn(
                  buttonVariants({ size: "lg", variant: "ghost" }),
                  "border border-white/20 text-chalk hover:border-white/40 hover:bg-white/5",
                )}
              >
                I'm a jeweller
              </Link>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionHeading title="How it works" />
          <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="reveal">
                <span className="tabular block font-display text-[64px] leading-none text-gold" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-5 border-t border-line pt-5 font-display text-[26px] text-ink">{s.title}</h3>
                <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-ink/75">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you can verify */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-28">
          <div>
            <SectionHeading title="What you can verify">
              Everything the jeweller registered for the piece, on one page.
            </SectionHeading>
            <dl className="mt-10 divide-y divide-line border-y border-line">
              {VERIFIABLE.map((v) => (
                <div key={v.label} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
                  <dt className="text-[15px] font-medium text-ink">{v.label}</dt>
                  <dd className="text-[15px] text-muted">{v.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* An excerpt of the buyer page */}
          <div className="reveal self-center overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_30px_60px_-40px_rgba(21,25,27,0.45)]">
            <div className="flex items-start justify-between gap-4 px-6 py-6 sm:px-8">
              <div>
                <p className="text-[13px] font-semibold text-gold-deep">Jewellery details</p>
                <p className="mt-1.5 font-display text-[26px] text-ink">Ring</p>
                <p className="mt-1 text-[15px] text-ink/75">Casting ring in 22K gold</p>
              </div>
              <HallmarkStamp purity="22K" percent="91.6" size="lg" />
            </div>
            <dl className="border-t border-line px-6 py-4 text-[15px] sm:px-8">
              {[
                ["Jewellery ID", "JWL-26-ABKUCR"],
                ["Purity", "22K / 91.6%"],
                ["Gross weight", "4.88 g"],
                ["Net gold weight", "4.88 g"],
                ["Certificate ID", "CERT-XXXXXX"],
                ["Verification status", "Verified"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className={cn("tabular", v === "Verified" ? "font-medium text-verified" : "text-ink")}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Price transparency */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_440px] lg:gap-20 lg:py-28">
          <div>
            <SectionHeading title="Price, itemised">
              A single number on a tag tells you very little. The record shows how the total is made up, so you can
              compare like with like.
            </SectionHeading>
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-muted">
              Gold value, making charges, stone or other component value and tax are listed separately and add up to
              the total price.
            </p>
          </div>
          <div className="reveal rounded-[14px] border border-line bg-chalk p-6 sm:p-8">
            <p className="mb-6 text-[13px] text-muted">Example breakdown</p>
            <PriceBreakdown price={EXAMPLE_PRICE} emphasis />
          </div>
        </div>
      </section>

      {/* Why digital verification */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionHeading title="Why a digital record" />
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className="grid size-10 place-items-center rounded-full bg-basalt text-gold-bright">
                  <Icon className="size-[18px]" strokeWidth={1.6} />
                </span>
                <h3 className="mt-5 text-[17px] font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/75">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 rounded-[10px] border border-line bg-white px-5 py-4 text-[15px] leading-relaxed text-ink/80">
            <span className="font-medium text-ink">What it does not do. </span>
            Jewlerify verifies the information associated with a registered digital record. It does not independently
            perform physical gold purity testing.
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="grain">
        <div className="mx-auto grid max-w-6xl items-end gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <h2 className="font-display text-[34px] leading-[1.08] text-chalk sm:text-[46px]">Holding a tagged piece?</h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-chalk/70">
              Point your phone camera at its QR code, or type the Jewellery ID printed underneath it.
            </p>
          </div>
          <CodeEntryForm tone="dark" />
        </div>
      </section>
    </>
  );
}
