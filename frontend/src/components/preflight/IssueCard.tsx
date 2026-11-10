import { FileText, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Issue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SEVERITY, SeverityBadge } from "./SeverityBadge";

interface IssueCardProps {
  issue: Issue;
  clientName: string;
  onFix?: (issue: Issue) => void;
}

export function IssueCard({ issue, clientName, onFix }: IssueCardProps) {
  const s = SEVERITY[issue.severity];
  const Icon = s.icon;
  const canFix = Boolean(onFix && issue.fixLabel && issue.fixValue);

  return (
    <article
      className="rounded-xl border bg-surface p-4 transition-colors"
      aria-labelledby={`issue-${issue.id}-title`}
    >
      <div className="flex gap-3">
        <div
          className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", s.iconBox)}
          aria-hidden="true"
        >
          <Icon className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <SeverityBadge severity={issue.severity} />
              <h3
                id={`issue-${issue.id}-title`}
                className="mt-2 text-sm font-semibold text-foreground"
              >
                {issue.title}
              </h3>
            </div>
            {canFix && (
              <Button
                type="button"
                size="sm"
                variant="tint"
                onClick={() => onFix?.(issue)}
                aria-label={`${issue.fixLabel}: ${issue.title}`}
              >
                <Wand2 aria-hidden="true" />
                {issue.fixLabel}
              </Button>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{issue.message}</p>

          {issue.evidence && (
            <figure className="mt-3 rounded-md border border-info/25 bg-info-tint px-3 py-2.5">
              <figcaption className="flex items-center gap-1.5 text-xs font-medium text-info-strong">
                <FileText className="size-3.5" aria-hidden="true" />
                From {clientName}&rsquo;s AP doc:
              </figcaption>
              <blockquote className="mt-1 text-sm leading-relaxed text-foreground">
                &ldquo;{issue.evidence}&rdquo;
              </blockquote>
            </figure>
          )}
        </div>
      </div>
    </article>
  );
}
