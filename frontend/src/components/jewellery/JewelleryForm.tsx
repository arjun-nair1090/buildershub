import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, PencilLine } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { useStores } from "@/hooks/useStores";
import { ApiError } from "@/services/api";
import {
  GOLD_COLOURS,
  JEWELLERY_TYPES,
  PURITIES,
  PURITY_PERCENT,
  STOCK_LABEL,
  STOCK_STATUSES,
  VERIFICATION_LABEL,
  VERIFICATION_LEVELS,
  type JewelleryInput,
  type VerificationLevel,
} from "@/types";
import { formatINR, formatINRRange, sumMoney } from "@/utils/format";
import { CertificateUpload } from "./CertificateUpload";
import { DiscountPreview } from "./DiscountPreview";
import { emptyValues, jewellerySchema, toInput, toPreviewInput, type JewelleryFormValues } from "./jewellerySchema";

const LEVEL_HINT: Record<VerificationLevel, string> = {
  declared: "The store's own description. Buyers are told no hallmark or certificate is linked.",
  hallmark: "Linked to the piece's BIS hallmark. Buyers see the HUID.",
  lab: "Backed by a lab certificate. Buyers see its ID, issuer and date. The certificate file must be attached.",
};

interface JewelleryFormProps {
  defaultValues?: JewelleryFormValues;
  submitLabel: string;
  cancelTo: string;
  existingDocument?: { onDownload: () => void; onRemove: () => void } | null;
  /** Publishing needs a photo, and photos are added on the record page once the piece is saved. */
  canPublish: boolean;
  onSubmit: (input: JewelleryInput, certificate: File | null) => Promise<void>;
}

function Section({ step, title, description, children }: { step: number; title: string; description: string; children: ReactNode }) {
  return (
    <Panel className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[220px_1fr] lg:gap-10 lg:p-8">
      <div>
        <span className="tabular text-[13px] font-semibold text-gold-deep">{String(step).padStart(2, "0")}</span>
        <h2 className="mt-1 text-[15px] font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </Panel>
  );
}

export function JewelleryForm({ defaultValues = emptyValues, submitLabel, cancelTo, existingDocument, canPublish, onSubmit }: JewelleryFormProps) {
  const [certificate, setCertificate] = useState<File | null>(null);
  const { stores } = useStores();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<JewelleryFormValues>({ resolver: zodResolver(jewellerySchema), defaultValues, mode: "onTouched" });

  const values = useWatch({ control }) as JewelleryFormValues;
  const { gold_value: gold, making_charges: making, other_component_value: other, tax, manual_total: manual, purity } = values;
  const { making_percent_min: makingMin, making_percent_max: makingMax, verification_level: level, discount_type: discountType } = values;

  // With a single store there's nothing to choose.
  useEffect(() => {
    if (stores?.length === 1 && !getValues("store")) setValue("store", stores[0].slug);
  }, [stores, getValues, setValue]);

  const calculated = sumMoney(gold, making, other, tax);
  const rangeExample =
    Number(gold) > 0 && makingMin && makingMax
      ? formatINRRange(Math.round((Number(gold) * Number(makingMin)) / 100), Math.round((Number(gold) * Number(makingMax)) / 100))
      : null;

  async function submit(values: JewelleryFormValues) {
    try {
      await onSubmit(toInput(values), certificate);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in values) setError(field as keyof JewelleryFormValues, { message });
        }
      }
      toast.error(err instanceof ApiError ? err.message : "The record could not be saved. Try again.");
    }
  }

  const moneyProps = { inputMode: "decimal" as const, prefix: "₹", placeholder: "0", autoComplete: "off" };

  return (
    <form onSubmit={handleSubmit(submit, () => toast.error("Check the highlighted fields."))} noValidate className="space-y-5">
      <Section step={1} title="Basic information" description="What the piece is and which store sells it.">
        <Field label="Store" error={errors.store?.message}>
          <Select {...register("store")} disabled={!stores}>
            <option value="" disabled>
              {stores ? "Choose a store" : "Loading stores…"}
            </option>
            {stores?.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s.area})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" error={errors.title?.message} hint="Short, as buyers would say it: Nakshi kada, Temple necklace">
          <Input maxLength={120} {...register("title")} />
        </Field>
        <Field label="Category" error={errors.type?.message}>
          <Select {...register("type")}>
            <option value="" disabled>
              Choose a category
            </option>
            {JEWELLERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" error={errors.description?.message} hint="For example: 22K gold ring with a 0.30 ct solitaire">
          <Textarea rows={3} maxLength={500} {...register("description")} />
        </Field>
        <Field label="Colour" optional error={errors.colour?.message}>
          <Select {...register("colour")}>
            <option value="">Not specified</option>
            {GOLD_COLOURS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Design details" optional error={errors.design_details?.message} hint="Motifs, finish, stones, clasp: what makes this piece recognisable">
          <Textarea rows={3} maxLength={1000} {...register("design_details")} />
        </Field>
        <p className="text-[13px] text-muted">Photos are added on the piece's page after you save it.</p>
      </Section>

      <Section step={2} title="Gold information" description="Purity and weights as recorded at registration.">
        <Field label="Purity / karat" error={errors.purity?.message} hint={purity ? `${PURITY_PERCENT[purity]}% gold` : undefined}>
          <Select {...register("purity")}>
            {PURITIES.map((p) => (
              <option key={p} value={p}>
                {p} ({PURITY_PERCENT[p]}%)
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Gross weight" error={errors.gross_weight?.message} hint="Whole piece, including stones">
            <Input inputMode="decimal" placeholder="0.000" suffix={<span className="pr-2 text-sm text-muted">g</span>} {...register("gross_weight")} />
          </Field>
          <Field label="Net gold weight" error={errors.net_weight?.message} hint="Gold only">
            <Input inputMode="decimal" placeholder="0.000" suffix={<span className="pr-2 text-sm text-muted">g</span>} {...register("net_weight")} />
          </Field>
        </div>
      </Section>

      <Section step={3} title="Verification" description="How far the store vouches for this piece. The buyer's badge matches it exactly.">
        <Field label="Verification level" error={errors.verification_level?.message} hint={LEVEL_HINT[level ?? "declared"]}>
          <Select {...register("verification_level")}>
            {VERIFICATION_LEVELS.map((l) => (
              <option key={l} value={l}>
                {VERIFICATION_LABEL[l]}
              </option>
            ))}
          </Select>
        </Field>
        {level === "hallmark" && (
          <Field label="HUID" error={errors.huid?.message} hint="The 6-character code laser-marked on the piece">
            <Input autoComplete="off" maxLength={6} className="uppercase tracking-[0.2em]" placeholder="AB12CD" {...register("huid")} />
          </Field>
        )}
        {level === "lab" && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Certificate ID" error={errors.certificate_id?.message}>
                <Input autoComplete="off" placeholder="e.g. HM-26-014823" {...register("certificate_id")} />
              </Field>
              <Field label="Certificate date" error={errors.certificate_date?.message}>
                <Input type="date" max={new Date().toISOString().slice(0, 10)} {...register("certificate_date")} />
              </Field>
            </div>
            <Field label="Issuing authority" error={errors.issuing_authority?.message}>
              <Input placeholder="e.g. assaying and hallmarking centre" {...register("issuing_authority")} />
            </Field>
            <CertificateUpload file={certificate} onChange={setCertificate} existing={existingDocument} />
          </>
        )}
      </Section>

      <Section step={4} title="Pricing" description="Each component is shown to the buyer. The total is added up for you.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Gold value" error={errors.gold_value?.message}>
            <Input {...moneyProps} {...register("gold_value")} />
          </Field>
          <Field label="Making charges" error={errors.making_charges?.message}>
            <Input {...moneyProps} {...register("making_charges")} />
          </Field>
          <Field label="Stone / other component value" error={errors.other_component_value?.message} hint="Leave blank if none">
            <Input {...moneyProps} {...register("other_component_value")} />
          </Field>
          <Field label="Tax" error={errors.tax?.message}>
            <Input {...moneyProps} {...register("tax")} />
          </Field>
        </div>

        <div className="space-y-3 rounded-md border border-line p-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Making charges range for buyers</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              With a live gold rate, buyers see the gold value at today's rate and making charges as this range of it. Tax is
              recalculated at the store's GST rate. Leave blank to show the making charges above.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Minimum" error={errors.making_percent_min?.message}>
              <Input inputMode="decimal" placeholder="e.g. 10" autoComplete="off" suffix={<span className="pr-2 text-sm text-muted">%</span>} {...register("making_percent_min")} />
            </Field>
            <Field label="Maximum" error={errors.making_percent_max?.message}>
              <Input inputMode="decimal" placeholder="e.g. 14" autoComplete="off" suffix={<span className="pr-2 text-sm text-muted">%</span>} {...register("making_percent_max")} />
            </Field>
          </div>
          {rangeExample && <p className="text-[13px] text-muted">On the gold value above, that is {rangeExample}.</p>}
        </div>

        <div className="rounded-md border border-line bg-canvas p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] text-muted">
              <Calculator className="size-4 text-gold" strokeWidth={1.5} />
              Calculated total
            </span>
            <span className={manual ? "tabular text-lg text-muted line-through" : "tabular text-xl font-semibold text-ink"}>
              {formatINR(calculated)}
            </span>
          </div>

          {manual ? (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <Field label="Corrected total price" error={errors.total_price?.message} hint="Use only to correct rounding on the bill.">
                <Input {...moneyProps} {...register("total_price")} />
              </Field>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setValue("manual_total", false);
                  setValue("total_price", "");
                }}
              >
                Use the calculated total
              </Button>
            </div>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="mt-2 text-[13px]"
              onClick={() => {
                setValue("manual_total", true);
                setValue("total_price", calculated ? String(calculated) : "");
              }}
            >
              <PencilLine /> Correct the total manually
            </Button>
          )}
        </div>
      </Section>

      <Section step={5} title="Listing and discount" description="Whether buyers can see the piece, and any offer on it.">
        <Field label="Stock" error={errors.stock_status?.message}>
          <Select {...register("stock_status")}>
            {STOCK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STOCK_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-1.5">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-4 accent-basalt" disabled={!canPublish && !values.is_published} {...register("is_published")} />
            <span>
              <span className="block text-[13px] font-medium text-ink">Published</span>
              <span className="block text-[13px] text-muted">
                {canPublish
                  ? "Buyers can see this piece and its QR code opens its page."
                  : values.is_published
                    ? "Live without a photo. Add one on the piece's page; if you unpublish it, you'll need a photo to publish it again."
                    : "Add a photo on the piece's page first. Until it's published, its QR code says the record wasn't found."}
              </span>
            </span>
          </label>
          {errors.is_published && (
            <p role="alert" className="text-[13px] text-danger">
              {errors.is_published.message}
            </p>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Discount" error={errors.discount_type?.message}>
            <Select {...register("discount_type")}>
              <option value="">No discount</option>
              <option value="percent">Percent off</option>
              <option value="flat">Flat amount off</option>
            </Select>
          </Field>
          <Field label={discountType === "flat" ? "Amount off" : "Percent off"} error={errors.discount_value?.message}>
            <Input
              inputMode="decimal"
              autoComplete="off"
              disabled={!discountType}
              prefix={discountType === "flat" ? "₹" : undefined}
              suffix={discountType === "percent" ? <span className="pr-2 text-sm text-muted">%</span> : undefined}
              {...register("discount_value")}
            />
          </Field>
          <Field label="Ends on" optional error={errors.discount_ends_on?.message} hint="Last day of the offer">
            <Input type="date" disabled={!discountType} {...register("discount_ends_on")} />
          </Field>
        </div>
        <DiscountPreview input={toPreviewInput(values)} />
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-lg sm:border sm:bg-white sm:px-6">
        <Link to={cancelTo} className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-ink hover:bg-basalt-50">
          Cancel
        </Link>
        <Button type="submit" size="lg" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
