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
    badge: "bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs font-semibold",
    iconBox: "bg-rose-50 text-rose-600 border border-rose-200/60",
    icon_: "text-rose-600",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badge: "bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs font-semibold",
    iconBox: "bg-amber-50 text-amber-600 border border-amber-200/60",
    icon_: "text-amber-600",
  },
  pass: {
    label: "Passed",
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs font-semibold",
    iconBox: "bg-emerald-50 text-emerald-600 border border-emerald-200/60",
    icon_: "text-emerald-600",
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
        "inline-flex h-6.5 items-center gap-1.5 rounded-full px-3 text-xs font-semibold leading-none tracking-tight transition-colors",
        s.badge,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}
