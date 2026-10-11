import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { GoldRateTicker } from "@/components/verify/GoldRateTicker";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/services/api";
import { settingsService } from "@/services/settings";
import type { StoreSettings } from "@/types";

const schema = z.object({
  store_name: z.string().trim().min(2, "Enter the store name").max(120, "Keep it under 120 characters"),
  gst_percent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Use a percentage with up to 2 decimals, e.g. 3")
    .refine((v) => Number(v) <= 100, "Must be 100% or less"),
});
type Values = z.infer<typeof schema>;

export function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { store_name: "", gst_percent: "3" } });

  useEffect(() => {
    document.title = "Store settings";
    settingsService
      .get()
      .then((s) => {
        setSettings(s);
        reset({ store_name: s.store_name, gst_percent: String(Number(s.gst_percent)) });
      })
      .catch((err) => toast.error(errorMessage(err)));
  }, [reset]);

  async function onSubmit(values: Values) {
    try {
      setSettings(await settingsService.update(values));
      toast.success("Store settings saved.");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in schema.shape) setError(field as keyof Values, { message });
        }
      } else toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Store settings" description="What buyers see on every verification page." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Panel>
          <PanelHeader title="Store" />
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 p-5 sm:p-6">
            <Field label="Store name" error={errors.store_name?.message} hint="Shown at the top of the page a buyer opens from the QR code.">
              <Input autoComplete="organization" {...register("store_name")} />
            </Field>
            <Field label="GST on jewellery" error={errors.gst_percent?.message} hint="Applied to gold value, making charges and other components in the live price.">
              <Input inputMode="decimal" suffix={<span className="pr-2 text-sm text-muted">%</span>} {...register("gst_percent")} />
            </Field>
            <Button type="submit" loading={isSubmitting}>
              Save settings
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Live gold rate" description="Market rate used for buyers' live prices." />
          <div className="p-5 sm:p-6">
            {settings === null ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ) : settings.gold_rate ? (
              <>
                <GoldRateTicker rate={settings.gold_rate} />
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  Refreshed from {settings.gold_rate.source} at most every {settings.gold_rate_ttl_minutes} minutes.
                </p>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-muted">
                {settings.gold_feed_configured
                  ? "No rate has been fetched yet. Check the gold rate API key on the server if this persists."
                  : "Not connected. Set METALS_DEV_API_KEY (or GOLDAPI_KEY) on the server to show buyers live prices; until then they see the registered amounts."}
              </p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
