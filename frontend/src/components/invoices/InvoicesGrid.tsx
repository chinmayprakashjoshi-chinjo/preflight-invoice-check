import { useMemo } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ExternalLink, Loader2 } from "lucide-react";
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
  headerBackgroundColor: "oklch(0.975 0.005 250)",
  headerTextColor: "oklch(0.45 0.03 257)",
  headerFontSize: 12,
  headerFontWeight: 600,
  rowHoverColor: "oklch(0.985 0.005 250)",
  selectedRowBackgroundColor: "var(--primary-tint)",
  oddRowBackgroundColor: "var(--surface)",
  borderRadius: 10,
  wrapperBorderRadius: 16,
  wrapperBorder: true,
  rowBorder: true,
  columnBorder: false,
  headerColumnBorder: false,
  spacing: 8,
  cellHorizontalPadding: 18,
  rowHeight: 60,
  headerHeight: 48,
  browserColorScheme: "light",
});

export interface InvoicesGridContext {
  pendingId: string | null;
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
  const payerUrl =
    (data as InvoiceRecord & { payer_view_url?: string }).payer_view_url || data.payerLink;

  if (!actionable) {
    return payerUrl ? (
      <div className="flex h-full items-center [&_button]:px-2.5">
        <Button asChild size="sm" variant="outline">
          <a
            href={payerUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open payer link for ${data.number}`}
          >
            <ExternalLink aria-hidden="true" />
            Payer link
          </a>
        </Button>
      </div>
    ) : (
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
        variant="tint"
        disabled={pending}
        onClick={() => context.onMarkPaid(data)}
        aria-label={`Mark ${data.number} paid in sandbox`}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Mark paid (sandbox)
      </Button>
      {payerUrl && (
        <Button asChild size="sm" variant="outline">
          <a
            href={payerUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open payer link for ${data.number}`}
          >
            <ExternalLink aria-hidden="true" />
            Payer link
          </a>
        </Button>
      )}
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
      { field: "clientName", headerName: "Client", width: 200, flex: 0 },
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
        width: 140,
        flex: 0,
        cellRenderer: StatusCell,
      },
      {
        field: "dueDate",
        headerName: "Due date",
        width: 135,
        flex: 0,
        cellClass: "tabular",
        valueFormatter: (p) => (p.value ? formatDate(p.value) : ""),
      },
      {
        field: "paypalInvoiceId",
        headerName: "PayPal invoice ID",
        width: 250,
        flex: 0,
        cellClass: "tabular text-muted-foreground",
        valueFormatter: (p) => p.value ?? "Not sent yet",
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
        field: "updatedNote",
        headerName: "Updated",
        width: 210,
        flex: 0,
      },
      {
        headerName: "Actions",
        colId: "actions",
        width: 340,
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
        suppressColumnVirtualisation
        suppressCellFocus
        domLayout="autoHeight"
        animateRows={false}
        overlayNoRowsTemplate='<span style="color: var(--muted-foreground); font-size: 14px;">No invoices match these filters.</span>'
      />
    </div>
  );
}
