import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, PencilLine } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { ApiError } from "@/services/api";
import { GOLD_COLOURS, JEWELLERY_TYPES, PURITIES, PURITY_PERCENT, type JewelleryInput } from "@/types";
import { formatINR, formatINRRange, sumMoney } from "@/utils/format";
import { CertificateUpload } from "./CertificateUpload";
import { emptyValues, jewellerySchema, toInput, type JewelleryFormValues } from "./jewellerySchema";
import { PhotoUpload } from "./PhotoUpload";

interface JewelleryFormProps {
  defaultValues?: JewelleryFormValues;
  submitLabel: string;
  cancelTo: string;
  existingDocument?: { onDownload: () => void; onRemove: () => void } | null;
  existingPhoto?: { url: string | null; onRemove: () => void } | null;
  onSubmit: (input: JewelleryInput, certificate: File | null, photo: File | null) => Promise<void>;
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

export function JewelleryForm({ defaultValues = emptyValues, submitLabel, cancelTo, existingDocument, existingPhoto, onSubmit }: JewelleryFormProps) {
  const [certificate, setCertificate] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<JewelleryFormValues>({ resolver: zodResolver(jewellerySchema), defaultValues, mode: "onTouched" });

  const [gold, making, other, tax, manual, purity, makingMin, makingMax] = useWatch({
    control,
    name: ["gold_value", "making_charges", "other_component_value", "tax", "manual_total", "purity", "making_percent_min", "making_percent_max"],
  });
  const calculated = sumMoney(gold, making, other, tax);
  const rangeExample =
    Number(gold) > 0 && makingMin && makingMax
      ? formatINRRange(Math.round((Number(gold) * Number(makingMin)) / 100), Math.round((Number(gold) * Number(makingMax)) / 100))
      : null;

  async function submit(values: JewelleryFormValues) {
    try {
      await onSubmit(toInput(values), certificate, photo);
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
      <Section step={1} title="Basic information" description="What the piece is, as the buyer should read it.">
        <Field label="Jewellery type" error={errors.type?.message}>
          <Select {...register("type")}>
            <option value="" disabled>
              Choose a type
            </option>
            {JEWELLERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" error={errors.description?.message} hint="For example: 22K gold diamond ring with a 0.30 ct solitaire">
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
        <PhotoUpload file={photo} onChange={setPhoto} existing={existingPhoto} />
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

      <Section step={3} title="Certification" description="The hallmark or lab certificate this piece was issued. Leave blank if there isn't one.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Certificate ID" optional error={errors.certificate_id?.message}>
            <Input autoComplete="off" placeholder="e.g. HM-26-014823" {...register("certificate_id")} />
          </Field>
          <Field label="Certificate date" optional error={errors.certificate_date?.message}>
            <Input type="date" max={new Date().toISOString().slice(0, 10)} {...register("certificate_date")} />
          </Field>
        </div>
        <Field label="Issuing authority" optional error={errors.issuing_authority?.message}>
          <Input placeholder="e.g. assaying and hallmarking centre" {...register("issuing_authority")} />
        </Field>
        <CertificateUpload file={certificate} onChange={setCertificate} existing={existingDocument} />
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

        <div className="rounded-md border border-line bg-chalk p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] text-muted">
              <Calculator className="size-4 text-gold" strokeWidth={1.5} />
              Calculated total
            </span>
            <span className={manual ? "tabular text-lg text-muted line-through" : "tabular text-xl font-semibold text-basalt"}>
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

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-line bg-chalk/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-lg sm:border sm:bg-white sm:px-6">
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
