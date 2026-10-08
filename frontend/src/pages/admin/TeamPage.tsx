import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, errorMessage } from "@/services/api";
import { authService } from "@/services/auth";
import type { AdminUser } from "@/types";
import { formatDate } from "@/utils/format";

const schema = z.object({
  name: z.string().trim().min(2, "Enter their name"),
  email: z.string().trim().min(1, "Enter their email").email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters"),
});
type Values = z.infer<typeof schema>;

/** Inline form under an admin's row: set a new password they'll sign in with. */
function ResetPasswordForm({ admin, onDone }: { admin: AdminUser; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setError("Use at least 10 characters");
    setBusy(true);
    try {
      await authService.resetAdminPassword(admin.email, password);
      toast.success(`Password reset. Share the new one with ${admin.name}.`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="rise mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
      <Field label={`New password for ${admin.name}`} error={error ?? undefined} className="flex-1">
        <Input type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="flex gap-2 sm:mt-[26px]">
        <Button type="submit" loading={busy}>Save password</Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}

export function TeamPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[] | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const load = useCallback(() => {
    authService.listAdmins().then(setAdmins).catch((err) => toast.error(errorMessage(err)));
  }, []);

  useEffect(() => {
    document.title = "Team";
    load();
  }, [load]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "" } });

  async function remove(admin: AdminUser) {
    try {
      await authService.removeAdmin(admin.email);
      toast.success(`${admin.name} removed.`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function onSubmit(values: Values) {
    try {
      const created = await authService.createAdmin(values);
      toast.success(`Admin added. Share the password with ${created.name} so they can sign in.`);
      reset();
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("email", { message: err.message });
      else if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in schema.shape) setError(field as keyof Values, { message });
        }
      } else toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Team" description="Everyone here can register jewellery and add other admins." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Panel>
          <PanelHeader title="Admins" description={admins ? `${admins.length} with access` : undefined} />
          {admins === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {admins.map((a) => {
                const isYou = a.email === user?.email;
                return (
                  <li key={a.email} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {a.name}
                          {isYou && <span className="ml-2 text-[13px] font-normal text-muted">(you)</span>}
                        </p>
                        <p className="truncate text-[13px] text-muted">
                          {a.email} · Added {formatDate(a.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setResetting(resetting === a.email ? null : a.email)}>
                          <KeyRound /> Reset password
                        </Button>
                        {!isYou && (
                          <ConfirmDialog
                            title={`Remove ${a.name}?`}
                            description={`${a.email} will be signed out and can no longer sign in. Their registered jewellery stays.`}
                            confirmLabel="Remove"
                            onConfirm={() => remove(a)}
                            trigger={
                              <Button size="sm" variant="danger-outline">
                                <Trash2 /> Remove
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </div>
                    {resetting === a.email && <ResetPasswordForm admin={a} onDone={() => setResetting(null)} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Add admin" description="They sign in with this email and password." />
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 p-5 sm:p-6">
            <Field label="Name" error={errors.name?.message}>
              <Input autoComplete="off" {...register("name")} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="off" {...register("email")} />
            </Field>
            <Field label="Starting password" error={errors.password?.message} hint="At least 10 characters. Share it with them privately.">
              <Input type="password" autoComplete="new-password" {...register("password")} />
            </Field>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              <UserPlus /> Add admin
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
