import { CircleSlash, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { CodeEntryForm } from "./CodeEntryForm";

interface RecordUnavailableProps {
  kind: "not-found" | "inactive" | "error";
  message?: string;
  onRetry?: () => void;
}

const COPY = {
  "not-found": {
    icon: SearchX,
    title: "Verification record not found",
    body: "This QR code does not correspond to a registered jewellery record.",
    advice: "If you entered the ID by hand, check it against the tag and try again. Otherwise, ask the jeweller for the item's registration details.",
  },
  inactive: {
    icon: CircleSlash,
    title: "Record inactive",
    body: "This jewellery record is no longer active in the verification system.",
    advice: "The jeweller has deactivated this record, so its details are not shown. Ask the jeweller why before relying on it.",
  },
  error: {
    icon: SearchX,
    title: "The record could not be checked",
    body: "",
    advice: "",
  },
} as const;

/** Shown instead of any jewellery details. Nothing partial or placeholder is displayed. */
export function RecordUnavailable({ kind, message, onRetry }: RecordUnavailableProps) {
  const copy = COPY[kind];
  const Icon = copy.icon;

  return (
    <div className="rise mx-auto max-w-xl px-4 py-12 sm:py-20">
      <div className="rounded-lg border border-line bg-white px-6 py-10 text-center sm:px-10">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-line-strong bg-canvas text-muted">
          <Icon className="size-6" strokeWidth={1.5} />
        </span>
        <p className="text-[13px] font-medium text-muted">Not verified</p>
        <h1 className="mt-1 font-display text-[26px] leading-tight text-ink sm:text-[30px]">{copy.title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink/80">{message ?? copy.body}</p>
        {copy.advice && <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">{copy.advice}</p>}
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-5 text-sm font-medium text-ink underline-offset-4 hover:underline">
            Try again
          </button>
        )}
      </div>

      {kind !== "error" && (
        <div className="mt-8 rounded-lg border border-line bg-white p-6">
          <p className="mb-4 text-[15px] text-ink">Check a different item</p>
          <CodeEntryForm />
        </div>
      )}

      <p className="mt-8 text-center text-sm">
        <Link to="/" className="text-muted underline-offset-4 hover:text-ink hover:underline">
          About digital verification
        </Link>
      </p>
    </div>
  );
}
