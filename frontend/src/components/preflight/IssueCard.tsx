import { Button } from "@/components/ui/button";
import type { Issue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SEVERITY } from "./SeverityBadge";

interface IssueCardProps {
  issue: Issue;
  clientName: string;
  onFix?: (issue: Issue) => void;
}

export function IssueCard({ issue, clientName, onFix }: IssueCardProps) {
  const s = SEVERITY[issue.severity];
  const Icon = s.icon;
  const canFix = Boolean(onFix && issue.fixLabel && issue.fixValue);

  const borderClass =
    issue.severity === "blocker"
      ? "border-l-4 border-l-red-500"
      : issue.severity === "warning"
        ? "border-l-4 border-l-amber-500"
        : "border-l-4 border-l-emerald-500";

  return (
    <article
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-slate-300 font-inter font-normal",
        borderClass,
      )}
      aria-labelledby={`issue-${issue.id}-title`}
    >
      <div className="flex gap-3.5">
        <div
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", s.iconBox)}
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <h3
              id={`issue-${issue.id}-title`}
              className="text-base font-semibold text-slate-900 leading-snug"
            >
              {issue.title}
            </h3>
            {canFix && (
              <Button
                type="button"
                size="sm"
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer",
                  issue.severity === "blocker"
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs",
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    onFix?.(issue);
                  } catch (err) {
                    console.error("[IssueCard] Error invoking onFix:", err);
                  }
                }}
                aria-label={`${issue.fixLabel}: ${issue.title}`}
              >
                {issue.fixLabel}
              </Button>
            )}
          </div>
          <p className="mt-1 text-sm font-normal text-slate-600 leading-relaxed">{issue.message}</p>

          {issue.evidence && (
            <figure className="mt-3.5 rounded-lg border-l-2 border-slate-300 bg-slate-50/80 px-3.5 py-2.5 text-sm">
              <figcaption className="text-sm font-medium text-slate-500">
                From {clientName}&rsquo;s AP doc:
              </figcaption>
              <blockquote className="mt-1 text-sm font-normal italic leading-relaxed text-slate-600">
                &ldquo;{issue.evidence}&rdquo;
              </blockquote>
            </figure>
          )}
        </div>
      </div>
    </article>
  );
}
