import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** h1 when the empty state is the whole page, e.g. a record that doesn't exist. */
  titleAs?: "h1" | "h3";
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, titleAs: Title = "h3", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <span className="mb-4 grid size-11 place-items-center rounded-full border border-line bg-canvas text-gold">
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <Title className="text-[15px] font-semibold text-ink">{title}</Title>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
