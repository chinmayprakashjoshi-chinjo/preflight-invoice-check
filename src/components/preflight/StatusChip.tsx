import { CheckCircle2, CircleDashed, Clock, Send, type LucideIcon } from "lucide-react";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<InvoiceStatus, { label: string; icon: LucideIcon; className: string }> = {
  draft: { label: "Draft", icon: CircleDashed, className: "bg-neutral-tint text-neutral-strong" },
  sent: { label: "Sent", icon: Send, className: "bg-primary-tint text-primary" },
  paid: { label: "Paid", icon: CheckCircle2, className: "bg-pass-tint text-pass-strong" },
  overdue: { label: "Overdue", icon: Clock, className: "bg-warning-tint text-warning-strong" },
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
        "inline-flex h-6 items-center whitespace-nowrap gap-1.5 rounded-full px-2.5 text-xs font-medium leading-none",
        s.className,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{s.label}</span>
    </span>
  );
}
