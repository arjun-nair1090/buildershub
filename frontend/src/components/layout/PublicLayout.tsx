import { Link, Outlet, useMatch } from "react-router-dom";
import { BrandMark } from "./BrandMark";

export function PublicHeader() {
  return (
    <header className="border-b border-line/80 bg-ivory">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandMark />
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/verify" className="hidden rounded-md px-3 py-2 text-charcoal hover:bg-emerald-50 sm:inline-flex">
            Verify jewellery
          </Link>
          <Link
            to="/admin/login"
            className="rounded-md border border-line-strong bg-white px-3 py-2 font-medium text-charcoal hover:border-emerald/40"
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
    <footer className="border-t border-line bg-ivory">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <p className="max-w-xl leading-relaxed">
          {onRecordPage
            ? "Records are registered and maintained by the issuing jeweller."
            : "This platform verifies the information associated with a registered digital record. It does not independently perform physical gold purity testing."}
        </p>
        <p className="shrink-0">© {new Date().getFullYear()} Jewellery Transparency &amp; Verification System</p>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
