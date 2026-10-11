import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { BrandMark, GoldBar } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", remember: true } });

  useEffect(() => {
    document.title = "Sign in to Jewlerify";
  }, []);

  if (state === "authenticated") return <Navigate to={from} replace />;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await login(values.email, values.password, values.remember);
      toast.success("Signed in.");
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status === 401
          ? "That email and password don't match an account. Check them and try again."
          : err instanceof ApiError
            ? err.message
            : "Sign-in failed. Try again.",
      );
    }
  }

  return (
    <div className="grid min-h-dvh bg-chalk lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="grain relative hidden flex-col justify-between overflow-hidden p-12 text-chalk lg:flex">
        <BrandMark tone="light" />
        <div className="max-w-sm">
          <p className="rise font-display text-[44px] leading-[1.05]">Register a piece once. Every buyer can check it.</p>
          <p className="rise mt-5 text-[15px] leading-relaxed text-chalk/70" style={{ "--d": "120ms" } as CSSProperties}>
            Add jewellery, print its QR code, and buyers see the registered details and price breakdown on their own
            phone.
          </p>
        </div>
        <p className="text-[13px] text-chalk/50">Jeweller and administrator access only.</p>
        <GoldBar className="pointer-events-none absolute -bottom-16 -right-20 w-96 rotate-12 opacity-[0.07]" />
      </aside>

      <main className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="rise mx-auto w-full max-w-sm">
          <BrandMark className="mb-12 lg:hidden" />
          <h1 className="font-display text-[38px] leading-tight text-basalt">Jeweller login</h1>
          <p className="mt-2 text-[15px] text-muted">Sign in to manage registered jewellery.</p>

          {formError && (
            <div role="alert" className="mt-6 flex gap-2.5 rounded-md border border-danger/25 bg-danger-50 px-3.5 py-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="username" autoFocus {...register("email")} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                {...register("password")}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="grid size-8 place-items-center rounded-sm text-muted hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
              <input type="checkbox" className="size-4 rounded-sm accent-gold" {...register("remember")} />
              Keep me signed in on this device
            </label>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          {import.meta.env.DEV && (
            <p className="mt-8 rounded-md border border-dashed border-line-strong px-3.5 py-3 text-[13px] text-muted">
              Demo account: admin@jewelverify.demo / Admin@12345
            </p>
          )}

          <p className="mt-10 text-sm">
            <Link to="/" className="text-muted underline-offset-4 hover:text-ink hover:underline">
              Back to the public site
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
