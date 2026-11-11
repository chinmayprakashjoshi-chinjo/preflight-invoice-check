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
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xs font-inter font-normal">
      <table className="w-full min-w-[720px] text-sm font-inter">
        <caption className="sr-only">Extracted AP requirements</caption>
        <thead className="border-b border-slate-200/80 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-3.5">
              Requirement
            </th>
            <th scope="col" className="px-5 py-3.5">
              Value
            </th>
            <th scope="col" className="px-5 py-3.5">
              <span>Evidence</span>{" "}
              <span className="ml-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                AI-extracted
              </span>
            </th>
            <th scope="col" className="px-5 py-3.5">
              Confidence
            </th>
            <th scope="col" className="w-20 px-5 py-3.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.key} className="align-top transition-colors hover:bg-slate-50/70">
              <th scope="row" className="px-5 py-4 text-left font-medium text-slate-900">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{r.label}</span>
                  {r.isNew && (
                    <span className="inline-flex items-center rounded-md border border-emerald-200/60 bg-emerald-50/80 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      New
                    </span>
                  )}
                </div>
                {r.edited && (
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Edited by you
                  </span>
                )}
              </th>
              <td className="tabular px-5 py-4 font-normal text-slate-700">{r.value}</td>
              <td className="max-w-sm px-5 py-4">
                <blockquote className="rounded-md border-l-2 border-slate-300 bg-slate-50/70 px-3.5 py-2 text-xs font-normal italic leading-relaxed text-slate-600">
                  &ldquo;{r.evidence}&rdquo;
                </blockquote>
              </td>
              <td className="px-5 py-4">
                <ConfidenceBadge confidence={r.confidence} />
              </td>
              <td className="px-4 py-3.5 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-md px-2.5 text-xs font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer inline-flex items-center gap-1.5"
                  onClick={() => onEdit(r.key)}
                  aria-label={`Edit ${r.label}`}
                >
                  <Pencil className="size-3.5 text-slate-400" aria-hidden="true" />
                  <span>Edit</span>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
