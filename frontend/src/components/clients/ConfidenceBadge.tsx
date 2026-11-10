import { CircleCheck, CircleHelp, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP: Record<Confidence, { label: string; icon: LucideIcon; className: string }> = {
  high: { label: "High", icon: CircleCheck, className: "bg-pass-tint text-pass-strong" },
  medium: { label: "Medium", icon: CircleHelp, className: "bg-info-tint text-info-strong" },
  low: { label: "Low", icon: TriangleAlert, className: "bg-warning-tint text-warning-strong" },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const c = MAP[confidence];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium leading-none",
        c.className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {c.label}
      <span className="sr-only"> confidence</span>
    </span>
  );
}
