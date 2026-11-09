import { useMemo } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/preflight/MoneyText";
import { PreflightResultPill } from "@/components/preflight/PreflightResultPill";
import { StatusChip } from "@/components/preflight/StatusChip";
import { formatDate } from "@/lib/format";
import type { InvoiceRecord } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

/** AG Grid theme wired to the PreFlight design tokens. */
const preflightTheme = themeQuartz.withParams({
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--foreground)",
  textColor: "var(--foreground)",
  borderColor: "var(--border)",
  accentColor: "var(--primary)",
  headerBackgroundColor: "var(--muted)",
  headerTextColor: "var(--muted-foreground)",
  headerFontSize: 12,
  headerFontWeight: 500,
  rowHoverColor: "var(--background)",
  selectedRowBackgroundColor: "var(--primary-tint)",
  oddRowBackgroundColor: "var(--surface)",
  borderRadius: 8,
  wrapperBorderRadius: 12,
  wrapperBorder: true,
  rowBorder: true,
  columnBorder: false,
  headerColumnBorder: false,
  spacing: 8,
  cellHorizontalPadding: 16,
  rowHeight: 56,
  headerHeight: 44,
  browserColorScheme: "light",
});

export interface InvoicesGridContext {
  pendingId: string | null;
  onRemind: (invoice: InvoiceRecord) => void;
  onMarkPaid: (invoice: InvoiceRecord) => void;
}

type Params = ICellRendererParams<InvoiceRecord, unknown, InvoicesGridContext>;

function AmountCell({ data }: Params) {
  if (!data) return null;
  return <MoneyText amount={data.amount} currency={data.currency} className="font-medium" />;
}

function StatusCell({ data }: Params) {
  return data ? <StatusChip status={data.status} /> : null;
}

function PreflightCell({ data }: Params) {
  return data ? <PreflightResultPill {...data.preflight} /> : null;
}

function ActionsCell({ data, context }: Params) {
  if (!data) return null;
  const actionable = data.status === "sent" || data.status === "overdue";
  if (!actionable) {
    return (
      <span className="text-sm text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No actions</span>
      </span>
    );
  }
  const pending = context.pendingId === data.id;
  return (
    <div className="flex h-full items-center gap-1.5 [&_button]:px-2.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => context.onRemind(data)}
        aria-label={`Send reminder for ${data.number}`}
      >
        Remind
      </Button>
      <Button
        type="button"
        size="sm"
        variant="tint"
        disabled={pending}
        onClick={() => context.onMarkPaid(data)}
        aria-label={`Mark ${data.number} paid in sandbox`}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Mark paid (sandbox)
      </Button>
    </div>
  );
}

interface InvoicesGridProps {
  rows: InvoiceRecord[];
  quickFilter: string;
  context: InvoicesGridContext;
}

export default function InvoicesGrid({ rows, quickFilter, context }: InvoicesGridProps) {
  const columnDefs = useMemo<ColDef<InvoiceRecord>[]>(
    () => [
      {
        field: "number",
        headerName: "Invoice #",
        width: 156,
        flex: 0,
        cellClass: "tabular font-medium",
      },
      { field: "clientName", headerName: "Client", flex: 1, minWidth: 140 },
      {
        field: "amount",
        headerName: "Amount",
        width: 115,
        flex: 0,
        type: "rightAligned",
        cellRenderer: AmountCell,
        getQuickFilterText: (p) => String(p.value),
      },
      { field: "currency", headerName: "Currency", width: 92, flex: 0 },
      {
        field: "status",
        headerName: "Status",
        width: 125,
        flex: 0,
        cellRenderer: StatusCell,
      },
      {
        field: "dueDate",
        headerName: "Due date",
        width: 122,
        flex: 0,
        cellClass: "tabular",
        valueFormatter: (p) => (p.value ? formatDate(p.value) : ""),
      },
      {
        headerName: "Pre-flight result",
        colId: "preflight",
        width: 135,
        flex: 0,
        sortable: false,
        valueGetter: (p) =>
          p.data
            ? p.data.preflight.blockers
              ? `${p.data.preflight.blockers} blockers`
              : p.data.preflight.warnings
                ? `${p.data.preflight.warnings} warnings`
                : "Cleared"
            : "",
        cellRenderer: PreflightCell,
      },
      {
        headerName: "Actions",
        colId: "actions",
        width: 240,
        flex: 0,
        pinned: "right",
        sortable: false,
        cellRenderer: ActionsCell,
      },
    ],
    [],
  );

  return (
    <div className="w-full">
      <AgGridReact<InvoiceRecord>
        theme={preflightTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true, flex: 1, suppressMovable: true }}
        context={context}
        quickFilterText={quickFilter}
        getRowId={(p) => p.data.id}
        suppressCellFocus
        domLayout="autoHeight"
        animateRows={false}
        overlayNoRowsTemplate='<span style="color: var(--muted-foreground); font-size: 14px;">No invoices match these filters.</span>'
      />
    </div>
  );
}
