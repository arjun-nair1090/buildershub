import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AdminLayout";
import { PhotoManager } from "@/components/photos/PhotoManager";
import { emptyStore, storeSchema, storeToForm, storeToInput, type StoreFormValues } from "@/components/stores/storeSchema";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/services/api";
import { storeService } from "@/services/stores";
import type { Store } from "@/types";

const back = (
  <Link to="/admin/stores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
    <ArrowLeft className="size-4" /> All stores
  </Link>
);

/** Add a store (/admin/stores/new) or edit one (/admin/stores/:slug/edit). Photos can be added once it's saved. */
export function StoreFormPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StoreFormValues>({ resolver: zodResolver(storeSchema), defaultValues: emptyStore, mode: "onTouched" });
  const [lat, lng] = useWatch({ control, name: ["latitude", "longitude"] });

  useEffect(() => {
    document.title = slug ? "Edit store" : "Add store";
    if (!slug) return;
    storeService
      .get(slug)
      .then((s) => {
        setStore(s);
        reset(storeToForm(s));
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [slug, reset]);

  async function onSubmit(values: StoreFormValues) {
    try {
      const saved = slug ? await storeService.update(slug, storeToInput(values)) : await storeService.create(storeToInput(values));
      toast.success(slug ? "Store saved." : "Store added. You can add its photos now.");
      if (saved.slug !== slug) navigate(`/admin/stores/${saved.slug}/edit`, { replace: true });
      else {
        setStore(saved);
        reset(storeToForm(saved));
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in storeSchema.shape) setError(field as keyof StoreFormValues, { message });
        }
      }
      toast.error(errorMessage(err, "The store could not be saved. Try again."));
    }
  }

  if (loadError) {
    return (
      <>
        {back}
        <Panel className="p-8 text-center text-sm text-danger">{loadError}</Panel>
      </>
    );
  }

  const mapUrl = /^-?\d+(\.\d+)?$/.test(lat) && /^-?\d+(\.\d+)?$/.test(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;
  const digits = { inputMode: "tel" as const, autoComplete: "off" };

  return (
    <>
      <PageHeader
        back={back}
        title={slug ? (store ? store.name : <Skeleton className="h-9 w-64" />) : "Add store"}
        description={slug ? "Changes show to buyers straight away." : "Save the store first; then you can add its photos."}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Panel>
          <PanelHeader title="Store details" />
          <form onSubmit={handleSubmit(onSubmit, () => toast.error("Check the highlighted fields."))} noValidate className="space-y-5 p-5 sm:p-6">
            <Field label="Store name" error={errors.name?.message}>
              <Input autoComplete="organization" {...register("name")} />
            </Field>
            <Field label="Web address" optional error={errors.slug?.message} hint="Used in the store's link. Leave blank to make one from the name.">
              <Input autoComplete="off" placeholder="e.g. shree-ganesh-jewellers" {...register("slug")} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <Textarea rows={2} {...register("address")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Area" error={errors.area?.message} hint="e.g. Zaveri Bazaar">
                <Input {...register("area")} />
              </Field>
              <Field label="City" error={errors.city?.message}>
                <Input autoComplete="address-level2" {...register("city")} />
              </Field>
            </div>
            <div className="space-y-2">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Latitude" error={errors.latitude?.message}>
                  <Input inputMode="decimal" placeholder="18.951700" {...register("latitude")} />
                </Field>
                <Field label="Longitude" error={errors.longitude?.message}>
                  <Input inputMode="decimal" placeholder="72.833100" {...register("longitude")} />
                </Field>
              </div>
              <p className="text-[13px] text-muted">
                In Google Maps, right-click the shop and click the coordinates to copy them.{" "}
                {mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-basalt hover:underline">
                    Check on map <ExternalLink className="size-3.5" />
                  </a>
                )}
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Phone" optional error={errors.phone?.message} hint="Buyers get a call button.">
                <Input {...digits} placeholder="+91 22 2345 6789" {...register("phone")} />
              </Field>
              <Field label="WhatsApp" optional error={errors.whatsapp?.message} hint="Buyers get a WhatsApp button.">
                <Input {...digits} placeholder="+91 98200 12345" {...register("whatsapp")} />
              </Field>
            </div>
            <Field label="Opening hours" error={errors.hours?.message} hint="e.g. Mon–Sat 10:30 am – 8:30 pm, closed Sunday">
              <Input {...register("hours")} />
            </Field>
            <Button type="submit" loading={isSubmitting}>
              {slug ? "Save store" : "Add store"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Photos" description="Shopfront and inside the store." />
          <div className="p-5 sm:p-6">
            {store ? (
              <PhotoManager owner="stores" ownerKey={store.slug} photos={store.photos} onChange={(photos) => setStore({ ...store, photos })} />
            ) : (
              <p className="text-[13px] text-muted">{slug ? "Loading…" : "Save the store first, then add its photos here."}</p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
