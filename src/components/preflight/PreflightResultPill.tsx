import { SeverityBadge } from "./SeverityBadge";
import { pluralize } from "@/lib/format";

/** Compact summary of a stored invoice's pre-flight result: "Cleared", "1 warning", "2 blockers". */
export function PreflightResultPill({ blockers, warnings }: { blockers: number; warnings: number }) {
  if (blockers > 0) return <SeverityBadge severity="blocker" label={pluralize(blockers, "blocker")} />;
  if (warnings > 0) return <SeverityBadge severity="warning" label={pluralize(warnings, "warning")} />;
  return <SeverityBadge severity="pass" label="Cleared" />;
}
