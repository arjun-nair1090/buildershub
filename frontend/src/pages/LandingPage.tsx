import { Camera, ListOrdered, ScanLine, ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HallmarkStamp } from "@/components/jewellery/HallmarkStamp";
import { PriceBreakdown } from "@/components/jewellery/PriceBreakdown";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { buttonVariants } from "@/components/ui/button";
import { CodeEntryForm } from "@/components/verify/CodeEntryForm";
import { cn } from "@/utils/cn";

function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="max-w-xl">
      <h2 className="font-display text-[30px] leading-tight text-emerald sm:text-[38px]">{title}</h2>
      {children && <p className="mt-3 text-[17px] leading-relaxed text-charcoal/75">{children}</p>}
    </div>
  );
}

const STEPS = [
  { n: "01", title: "Register", body: "Every jewellery item receives a unique digital identity." },
  { n: "02", title: "Scan", body: "Scan the QR code attached to the jewellery." },
  { n: "03", title: "Verify", body: "View the registered details and price breakdown." },
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
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_minmax(0,540px)] lg:gap-12 lg:pb-28">
        <div className="max-w-xl">
          <h1 className="font-display text-[46px] leading-[1.02] text-emerald sm:text-[64px] lg:text-[72px]">
            Know What You're Buying.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-charcoal/80">
            Verify your jewellery's registered details, certification information and price breakdown through one
            simple QR scan.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/verify" className={cn(buttonVariants({ size: "lg" }))}>
              Verify Jewellery
            </Link>
            <Link to="/admin/login" className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}>
              Jeweller Login
            </Link>
          </div>
        </div>
        <HeroVisual />
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <SectionHeading title="How it works" />
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t border-charcoal/80 pt-5">
                <p className="text-[13px] text-muted">
                  Step <span className="tabular font-semibold text-gold">{s.n}</span>
                </p>
                <h3 className="mt-3 font-display text-2xl text-charcoal">{s.title}</h3>
                <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-charcoal/75">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you can verify */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <SectionHeading title="What you can verify">
              Everything the jeweller registered for the piece, on one page.
            </SectionHeading>
            <dl className="mt-10 divide-y divide-line border-y border-line">
              {VERIFIABLE.map((v) => (
                <div key={v.label} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
                  <dt className="text-[15px] font-medium text-charcoal">{v.label}</dt>
                  <dd className="text-[15px] text-muted">{v.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* A real-looking excerpt of the buyer page */}
          <div className="self-center rounded-lg border border-line bg-white">
            <div className="flex items-start justify-between gap-4 px-6 py-6 sm:px-8">
              <div>
                <p className="text-[13px] font-semibold text-gold">Jewellery details</p>
                <p className="mt-1.5 font-display text-2xl text-charcoal">Ring</p>
                <p className="mt-1 text-[15px] text-charcoal/75">22K gold diamond ring</p>
              </div>
              <HallmarkStamp purity="22K" percent="91.6" size="lg" />
            </div>
            <dl className="border-t border-line px-6 py-4 text-[15px] sm:px-8">
              {[
                ["Jewellery ID", "JWL-26-A8F72K"],
                ["Purity", "22K / 91.6%"],
                ["Gross weight", "16.02 g"],
                ["Net gold weight", "15.42 g"],
                ["Certificate ID", "CERT-XXXXXX"],
                ["Verification status", "Verified"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="tabular text-charcoal">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Price transparency */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_440px] lg:gap-20 lg:py-24">
          <div>
            <SectionHeading title="Price transparency">
              A single number on a tag tells you very little. The verification page shows how the total is made up,
              so you can compare like with like.
            </SectionHeading>
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-muted">
              Gold value, making charges, stone or other component value and tax are listed separately and add up to
              the total price.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-ivory p-6 sm:p-8">
            <p className="mb-6 text-[13px] text-muted">Example breakdown</p>
            <PriceBreakdown gold_value={98500} making_charges={12000} other_component_value={4000} tax={10500} total_price={125000} emphasis />
          </div>
        </div>
      </section>

      {/* Why digital verification */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <SectionHeading title="Why digital verification" />
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon className="size-5 text-gold" strokeWidth={1.5} />
                <h3 className="mt-4 text-[17px] font-semibold text-charcoal">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-charcoal/75">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 rounded-md border border-line bg-white px-5 py-4 text-[15px] leading-relaxed text-charcoal/80">
            <span className="font-medium text-charcoal">What it does not do. </span>
            This platform verifies the information associated with a registered digital record. It does not
            independently perform physical gold purity testing.
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald">
        <div className="mx-auto grid max-w-6xl items-end gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 className="font-display text-[30px] leading-tight text-ivory sm:text-[38px]">Holding a tagged piece?</h2>
            <p className="mt-3 max-w-md text-[17px] leading-relaxed text-ivory/75">
              Point your phone camera at its QR code, or type the Jewellery ID printed underneath it.
            </p>
          </div>
          <CodeEntryForm tone="dark" />
        </div>
      </section>
    </>
  );
}
