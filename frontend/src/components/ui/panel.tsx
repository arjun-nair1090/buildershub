import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

/** White surface with a hairline border. The app's one container style. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-white", className)} {...props} />;
}

interface PanelHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, description, action, className }: PanelHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6", className)}>
      <div>
        <h2 className="text-[15px] font-semibold text-charcoal">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Label/value pair used in detail views. */
export function DataRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn("text-right text-[15px] text-charcoal", mono && "tabular font-medium tracking-wide")}>
        {value}
      </dd>
    </div>
  );
}
