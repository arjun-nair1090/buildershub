import type { RecordStatus, VerificationStatus } from "@/types";
import { cn } from "@/utils/cn";

const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

export function StatusBadge({ status, className }: { status: RecordStatus; className?: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        base,
        active ? "border-basalt/20 bg-basalt-50 text-basalt" : "border-line-strong bg-chalk text-muted",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-basalt" : "bg-muted/60")} aria-hidden />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  REGISTERED: "Registered, no certificate",
  INACTIVE: "Not verifiable",
};

export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  return (
    <span
      className={cn(
        base,
        status === "VERIFIED" && "border-gold/40 bg-gold-soft text-[#7a5f35]",
        status === "REGISTERED" && "border-line-strong bg-white text-ink",
        status === "INACTIVE" && "border-line-strong bg-chalk text-muted",
        className,
      )}
    >
      {VERIFICATION_LABEL[status]}
    </span>
  );
}
