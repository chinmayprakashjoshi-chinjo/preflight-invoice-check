import { CircleCheck, CircleHelp, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP: Record<
  Confidence,
  { label: string; icon: LucideIcon; textColor: string; iconColor: string }
> = {
  high: {
    label: "High",
    icon: CircleCheck,
    textColor: "text-emerald-600",
    iconColor: "text-emerald-500",
  },
  medium: {
    label: "Medium",
    icon: CircleHelp,
    textColor: "text-blue-600",
    iconColor: "text-blue-500",
  },
  low: {
    label: "Low",
    icon: TriangleAlert,
    textColor: "text-amber-600",
    iconColor: "text-amber-500",
  },
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const c = MAP[confidence];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-normal bg-transparent",
        c.textColor,
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", c.iconColor)} aria-hidden="true" />
      <span>{c.label}</span>
      <span className="sr-only"> confidence</span>
    </span>
  );
}
