import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  count: number;
  icon: LucideIcon;
  /** Pre-formatted amount lines, e.g. ["$3,200.00", "€1,425.00"]. */
  amounts: string[];
  tone: "neutral" | "primary" | "pass" | "warning";
  loading?: boolean;
}

const toneClass = {
  neutral: "bg-neutral-tint text-neutral-strong",
  primary: "bg-primary-tint text-primary",
  pass: "bg-pass-tint text-pass-strong",
  warning: "bg-warning-tint text-warning-strong",
};

export function KpiCard({ label, count, icon: Icon, amounts, tone, loading }: KpiCardProps) {
  return (
    <section className="rounded-xl border bg-surface p-5" aria-label={label}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        <span
          className={cn("flex size-8 items-center justify-center rounded-md", toneClass[tone])}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : (
        <>
          <p className="tabular mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {count}
          </p>
          <p className="tabular mt-1 text-sm text-muted-foreground">
            {amounts.length ? amounts.join(" · ") : "Nothing here yet"}
          </p>
        </>
      )}
    </section>
  );
}
