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
  neutral: "bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs",
  primary: "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs",
  pass: "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs",
  warning: "bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs",
};

export function KpiCard({ label, count, icon: Icon, amounts, tone, loading }: KpiCardProps) {
  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-surface p-5 shadow-xs hover:shadow-sm transition-all duration-200"
      aria-label={label}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        <span
          className={cn("flex size-9 items-center justify-center rounded-xl", toneClass[tone])}
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
          <p className="tabular mt-2 text-3xl font-bold tracking-tight text-foreground">{count}</p>
          <p className="tabular mt-1.5 text-xs font-medium text-muted-foreground">
            {amounts.length ? amounts.join(" · ") : "Nothing here yet"}
          </p>
        </>
      )}
    </section>
  );
}
