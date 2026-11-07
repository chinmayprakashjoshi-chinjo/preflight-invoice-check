import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RequirementRow } from "@/lib/requirements";
import type { RequirementKey } from "@/lib/types";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface RequirementsTableProps {
  rows: RequirementRow[];
  onEdit: (key: RequirementKey) => void;
}

export function RequirementsTable({ rows, onEdit }: RequirementsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Extracted AP requirements</caption>
        <thead className="bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Requirement</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Value</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Evidence</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Confidence</th>
            <th scope="col" className="w-16 px-4 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t align-top">
              <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                {r.label}
                {r.edited && (
                  <span className="mt-1 block text-xs font-normal text-primary">Edited by you</span>
                )}
              </th>
              <td className="tabular px-4 py-3 text-foreground">{r.value}</td>
              <td className="max-w-sm px-4 py-3">
                <blockquote className="border-l-2 border-info pl-3 text-muted-foreground">
                  &ldquo;{r.evidence}&rdquo;
                </blockquote>
              </td>
              <td className="px-4 py-3">
                <ConfidenceBadge confidence={r.confidence} />
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(r.key)}
                  aria-label={`Edit ${r.label}`}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
