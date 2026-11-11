import { CheckCircle2, CircleDashed, Clock, Send, type LucideIcon } from "lucide-react";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<InvoiceStatus, { label: string; icon: LucideIcon; className: string }> = {
  draft: {
    label: "Draft",
    icon: CircleDashed,
    className: "bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs",
  },
  sent: {
    label: "Sent",
    icon: Send,
    className: "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs",
  },
  paid: {
    label: "Paid",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs",
  },
  overdue: {
    label: "Overdue",
    icon: Clock,
    className: "bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs",
  },
};

export const STATUS_LABELS: Record<InvoiceStatus, string> = Object.fromEntries(
  Object.entries(STATUS).map(([k, v]) => [k, v.label]),
) as Record<InvoiceStatus, string>;

export function StatusChip({ status, className }: { status: InvoiceStatus; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6.5 items-center whitespace-nowrap gap-1.5 rounded-full px-3 text-xs font-semibold leading-none tracking-tight transition-colors",
        s.className,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{s.label}</span>
    </span>
  );
}
