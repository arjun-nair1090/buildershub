import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

/** Shown instead of a store or design page that can't be shown. Nothing partial is displayed. */
export function Unavailable({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div className="rise mx-auto max-w-xl px-4 py-12 sm:py-20">
      <div className="rounded-lg border border-line bg-white px-6 py-10 text-center sm:px-10">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-line-strong bg-canvas text-muted">
          <SearchX className="size-6" strokeWidth={1.5} />
        </span>
        <h1 className="font-display text-[26px] leading-tight text-ink sm:text-[30px]">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink/80">{body}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-5 text-sm font-medium text-ink underline-offset-4 hover:underline">
            Try again
          </button>
        )}
      </div>
      <p className="mt-8 text-center text-sm">
        <Link to="/" className="text-muted underline-offset-4 hover:text-ink hover:underline">
          Back to Jewlerify
        </Link>
      </p>
    </div>
  );
}
