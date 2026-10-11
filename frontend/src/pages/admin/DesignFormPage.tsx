import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { designSchema, designToForm, designToInput, emptyDesign, type DesignFormValues } from "@/components/designs/designSchema";
import { PageHeader } from "@/components/layout/AdminLayout";
import { PhotoManager } from "@/components/photos/PhotoManager";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/hooks/useStores";
import { ApiError, errorMessage } from "@/services/api";
import { designService } from "@/services/designs";
import { JEWELLERY_TYPES, PURITIES, PURITY_PERCENT, type Design } from "@/types";

const back = (
  <Link to="/admin/designs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
    <ArrowLeft className="size-4" /> All designs
  </Link>
);

/** Add a design (/admin/designs/new) or edit one (/admin/designs/:id/edit). Photos can be added once it's saved. */
export function DesignFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { stores } = useStores();
  const [design, setDesign] = useState<Design | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<DesignFormValues>({ resolver: zodResolver(designSchema), defaultValues: emptyDesign, mode: "onTouched" });

  useEffect(() => {
    document.title = id ? "Edit design" : "Add design";
    if (!id) return;
    designService
      .get(id)
      .then((d) => {
        setDesign(d);
        reset(designToForm(d));
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [id, reset]);

  useEffect(() => {
    if (stores?.length === 1 && !getValues("store")) setValue("store", stores[0].slug);
  }, [stores, getValues, setValue]);

  async function onSubmit(values: DesignFormValues) {
    try {
      const saved = id ? await designService.update(id, designToInput(values)) : await designService.create(designToInput(values));
      toast.success(id ? "Design saved." : "Design added. Add its photos, then publish it.");
      if (!id) navigate(`/admin/designs/${saved.public_id}/edit`, { replace: true });
      else {
        setDesign(saved);
        reset(designToForm(saved));
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in emptyDesign) setError(field as keyof DesignFormValues, { message });
        }
      }
      toast.error(errorMessage(err, "The design could not be saved. Try again."));
    }
  }

  if (loadError) {
    return (
      <>
        {back}
        <Panel>
          <EmptyState
            icon={SearchX}
            titleAs="h1"
            title={loadError}
            action={
              <Link to="/admin/designs" className={buttonVariants({ variant: "secondary" })}>
                Go to designs
              </Link>
            }
          />
        </Panel>
      </>
    );
  }

  const canPublish = (design?.photos.length ?? 0) > 0;
  const number = { inputMode: "decimal" as const, autoComplete: "off" };

  return (
    <>
      <PageHeader
        back={back}
        title={id ? (design ? design.title : <Skeleton className="h-9 w-64" />) : "Add design"}
        description="Shown to buyers as approximate, with no verified badge or Jewellery ID."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Panel>
          <PanelHeader title="Design details" />
          <form onSubmit={handleSubmit(onSubmit, () => toast.error("Check the highlighted fields."))} noValidate className="space-y-5 p-5 sm:p-6">
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
            <Field label="Title" error={errors.title?.message} hint="e.g. Temple necklace">
              <Input maxLength={120} {...register("title")} />
            </Field>
            <Field label="Category" error={errors.category?.message}>
              <Select {...register("category")}>
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
            <Field label="Description" optional error={errors.description?.message}>
              <Textarea rows={3} maxLength={1000} {...register("description")} />
            </Field>
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] font-medium text-ink">Purity options</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {PURITIES.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-[15px]">
                    <input type="checkbox" value={p} className="size-4 accent-basalt" {...register("purity_options")} />
                    {p} <span className="text-[13px] text-muted">({PURITY_PERCENT[p]}%)</span>
                  </label>
                ))}
              </div>
              {errors.purity_options && (
                <p role="alert" className="text-[13px] text-danger">
                  {errors.purity_options.message}
                </p>
              )}
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Weight from" error={errors.weight_min?.message}>
                <Input {...number} suffix={<span className="pr-2 text-sm text-muted">g</span>} {...register("weight_min")} />
              </Field>
              <Field label="Weight to" error={errors.weight_max?.message}>
                <Input {...number} suffix={<span className="pr-2 text-sm text-muted">g</span>} {...register("weight_max")} />
              </Field>
              <Field label="Approx. price from" error={errors.price_min?.message}>
                <Input {...number} prefix="₹" {...register("price_min")} />
              </Field>
              <Field label="Approx. price to" error={errors.price_max?.message}>
                <Input {...number} prefix="₹" {...register("price_max")} />
              </Field>
              <Field label="Making time from" error={errors.making_days_min?.message}>
                <Input inputMode="numeric" suffix={<span className="pr-2 text-sm text-muted">days</span>} {...register("making_days_min")} />
              </Field>
              <Field label="Making time to" error={errors.making_days_max?.message}>
                <Input inputMode="numeric" suffix={<span className="pr-2 text-sm text-muted">days</span>} {...register("making_days_max")} />
              </Field>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-0.5 size-4 accent-basalt" disabled={!canPublish} {...register("is_published")} />
                <span>
                  <span className="block text-[13px] font-medium text-ink">Published</span>
                  <span className="block text-[13px] text-muted">
                    {canPublish ? "Buyers can see this design." : "Add a photo first (save the design, then use Photos)."}
                  </span>
                </span>
              </label>
              {errors.is_published && (
                <p role="alert" className="text-[13px] text-danger">
                  {errors.is_published.message}
                </p>
              )}
            </div>
            <Button type="submit" loading={isSubmitting}>
              {id ? "Save design" : "Add design"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Photos" description="The first photo is the cover." />
          <div className="p-5 sm:p-6">
            {design ? (
              <PhotoManager owner="designs" ownerKey={design.public_id} photos={design.photos} onChange={(photos) => setDesign({ ...design, photos })} />
            ) : (
              <p className="text-[13px] text-muted">{id ? "Loading…" : "Save the design first, then add its photos here."}</p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
