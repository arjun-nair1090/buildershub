import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="rise mx-auto max-w-lg px-4 py-24 text-center">
      <p className="tabular font-display text-7xl text-gold">404</p>
      <h1 className="mt-4 font-display text-3xl text-ink">Page not found</h1>
      <p className="mt-3 text-[15px] text-muted">The address may be mistyped, or the page has moved.</p>
      <Link to="/" className={buttonVariants({ variant: "secondary", className: "mt-8" })}>
        Go to the home page
      </Link>
    </div>
  );
}
