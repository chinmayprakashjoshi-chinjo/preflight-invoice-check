import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center",
        tone === "error" ? "border-blocker/30 bg-blocker-tint" : "border-border-strong bg-surface",
        className,
      )}
      role={tone === "error" ? "alert" : undefined}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-lg",
          tone === "error" ? "bg-surface text-blocker" : "bg-primary-tint text-primary",
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
