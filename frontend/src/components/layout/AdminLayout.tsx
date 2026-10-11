import * as Dialog from "@radix-ui/react-dialog";
import { LayoutDashboard, LogOut, Menu, Palette, Plus, Settings, Store, Users, X } from "lucide-react";
import { GoldBarIcon } from "./GoldBarIcon";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";
import { BrandMark } from "./BrandMark";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/stores", label: "Stores", icon: Store, end: false },
  { to: "/admin/jewellery", label: "Pieces", icon: GoldBarIcon, end: true },
  { to: "/admin/jewellery/new", label: "Add piece", icon: Plus, end: true },
  { to: "/admin/designs", label: "Designs", icon: Palette, end: false },
  { to: "/admin/team", label: "Team", icon: Users, end: true },
  { to: "/admin/settings", label: "Store settings", icon: Settings, end: true },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    toast.success("Signed out.");
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <nav className="flex flex-col gap-1" aria-label="Admin">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                isActive ? "bg-white/10 text-chalk" : "text-chalk/70 hover:bg-white/5 hover:text-chalk",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-2 left-0 w-0.5 animate-[fade_300ms_ease-out] rounded-full bg-gold-bright" aria-hidden />}
                <Icon className="size-4" strokeWidth={1.75} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        {user && (
          <div className="mb-3 px-3">
            <p className="truncate text-sm text-chalk">{user.name}</p>
            <p className="truncate text-xs text-chalk/55">{user.email}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-chalk/70 hover:bg-white/5 hover:text-chalk"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-chalk lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="grain sticky top-0 hidden h-dvh flex-col px-4 py-6 lg:flex">
        <BrandMark to="/admin" tone="light" className="mb-10 px-2" />
        <NavItems />
      </aside>

      {/* Tablet / phone top bar with drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-basalt px-4 lg:hidden">
        <BrandMark to="/admin" tone="light" />
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="grid size-10 place-items-center rounded-md text-chalk hover:bg-white/10" aria-label="Open menu">
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 animate-[fade_200ms_ease-out] bg-ink/50" />
            <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-basalt px-4 py-5 focus:outline-none">
              <div className="mb-8 flex items-center justify-between">
                <Dialog.Title className="px-2 font-display text-lg text-chalk">Menu</Dialog.Title>
                <Dialog.Close className="grid size-9 place-items-center rounded-md text-chalk hover:bg-white/10" aria-label="Close menu">
                  <X className="size-5" />
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">Admin navigation</Dialog.Description>
              <NavItems onNavigate={() => setOpen(false)} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      <main key={location.pathname} className="min-w-0 animate-[fade_400ms_ease-out] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {back}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] leading-tight text-basalt sm:text-[32px]">{title}</h1>
          {description && <div className="mt-1.5 text-[15px] text-muted">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
