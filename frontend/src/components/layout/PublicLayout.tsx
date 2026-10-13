import { Link, NavLink, Outlet, useLocation, useMatch } from "react-router-dom";
import { NearMeProvider } from "@/hooks/useNearMe";
import { cn } from "@/utils/cn";
import { BrandMark } from "./BrandMark";

const NAV = [
  { to: "/search", label: "Browse", short: "Browse" },
  { to: "/feed", label: "Feed", short: "Feed" },
  { to: "/verify", label: "Verify jewellery", short: "Verify" },
] as const;

/** On the home page the header sits on the basalt hero; elsewhere it sits on chalk. */
export function PublicHeader() {
  const onHome = useMatch("/");
  return (
    <header className={cn("relative z-10", onHome ? "bg-basalt" : "border-b border-line bg-canvas")}>
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandMark tone={onHome ? "light" : "dark"} />
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2.5 py-2 transition-colors sm:px-3",
                  onHome ? "text-chalk/80 hover:text-chalk" : "text-ink hover:bg-basalt-50",
                  isActive && (onHome ? "text-chalk" : "font-medium"),
                )
              }
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}
          <Link
            to="/admin/login"
            className={cn(
              "hidden rounded-md border px-3.5 py-2 font-medium transition-colors sm:inline-flex",
              onHome
                ? "border-chalk/20 text-chalk hover:border-gold-bright hover:text-gold-bright"
                : "border-line-strong bg-white text-ink hover:border-gold/40",
            )}
          >
            Jeweller login
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const onRecordPage = useMatch("/verify/:token");
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <p className="max-w-xl leading-relaxed">
          {onRecordPage
            ? "Records are registered and maintained by the issuing jeweller."
            : "Jewlerify verifies the information associated with a registered digital record. It does not independently perform physical gold purity testing."}
        </p>
        <div className="flex shrink-0 items-center gap-4">
          <Link to="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
            Privacy
          </Link>
          <Link to="/admin/login" className="underline-offset-4 hover:text-ink hover:underline sm:hidden">
            Jeweller login
          </Link>
          <p>© {new Date().getFullYear()} Jewlerify</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <NearMeProvider>
      <div className="flex min-h-dvh flex-col">
        <PublicHeader />
        {/* Keyed by path so each page fades in on navigation. */}
        <main key={pathname} className="flex-1 animate-[fade_400ms_ease-out]">
          <Outlet />
        </main>
        <PublicFooter />
      </div>
    </NearMeProvider>
  );
}
