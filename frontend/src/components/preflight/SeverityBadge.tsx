import { AlertTriangle, CheckCircle2, OctagonX, type LucideIcon } from "lucide-react";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

export const SEVERITY: Record<
  Severity,
  { label: string; icon: LucideIcon; badge: string; iconBox: string; icon_: string }
> = {
  blocker: {
    label: "Blocker",
    icon: OctagonX,
    badge: "bg-blocker-tint text-blocker-strong",
    iconBox: "bg-blocker-tint text-blocker",
    icon_: "text-blocker",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badge: "bg-warning-tint text-warning-strong",
    iconBox: "bg-warning-tint text-warning",
    icon_: "text-warning",
  },
  pass: {
    label: "Passed",
    icon: CheckCircle2,
    badge: "bg-pass-tint text-pass-strong",
    iconBox: "bg-pass-tint text-pass",
    icon_: "text-pass",
  },
};

interface SeverityBadgeProps {
  severity: Severity;
  /** Overrides the default label, e.g. "2 blockers". */
  label?: string;
  className?: string;
}

export function SeverityBadge({ severity, label, className }: SeverityBadgeProps) {
  const s = SEVERITY[severity];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium leading-none",
        s.badge,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}
