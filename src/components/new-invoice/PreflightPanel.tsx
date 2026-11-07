import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  FileWarning,
  Loader2,
  ScanSearch,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/preflight/EmptyState";
import { IssueCard } from "@/components/preflight/IssueCard";
import { SeverityBadge } from "@/components/preflight/SeverityBadge";
import { pluralize } from "@/lib/format";
import { summarize } from "@/lib/preflight";
import type { Client, InvoiceRecord, Issue } from "@/lib/types";
import { SendArea } from "./SendArea";
import { SentState } from "./SentState";

interface PreflightPanelProps {
  client: Client | null;
  clientsLoading: boolean;
  issues: Issue[] | undefined;
  checking: boolean;
  sending: boolean;
  sent: InvoiceRecord | null;
  onFix: (issue: Issue) => void;
  onSend: () => void;
  onStartNew: () => void;
}

export function PreflightPanel(props: PreflightPanelProps) {
  return (
    <section
      aria-labelledby="preflight-title"
      className="flex flex-col rounded-xl border bg-surface wide:sticky wide:top-8"
    >
      <PanelBody {...props} />
    </section>
  );
}

function PanelHeader({ issues, checking }: { issues?: Issue[]; checking: boolean }) {
  const s = issues ? summarize(issues) : null;
  return (
    <div className="border-b px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          <h2 id="preflight-title" className="text-base font-semibold text-foreground">
            Pre-flight check
          </h2>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {checking ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Checking
            </>
          ) : s ? (
            <>
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Up to date
            </>
          ) : null}
        </span>
      </div>
      {s && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Check summary">
          <SeverityBadge severity="blocker" label={pluralize(s.blockers, "blocker")} />
          <SeverityBadge severity="warning" label={pluralize(s.warnings, "warning")} />
          <SeverityBadge severity="pass" label={`${s.passed} passed`} />
        </div>
      )}
    </div>
  );
}

function PanelBody({
  client,
  clientsLoading,
  issues,
  checking,
  sending,
  sent,
  onFix,
  onSend,
  onStartNew,
}: PreflightPanelProps) {
  if (sent) {
    return (
      <>
        <PanelHeader checking={false} />
        <div className="p-5">
          <SentState invoice={sent} onStartNew={onStartNew} />
        </div>
      </>
    );
  }

  if (clientsLoading) {
    return (
      <>
        <PanelHeader checking={false} />
        <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading client rules">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <PanelHeader checking={false} />
        <div className="p-5">
          <EmptyState
            icon={UserRoundSearch}
            title="Choose a client to run pre-flight"
            description="Pick a client account, or generate a draft from one line above. PreFlight then checks the invoice against that client's AP rules."
          />
        </div>
      </>
    );
  }

  if (client.docStatus === "error") {
    return (
      <>
        <PanelHeader checking={false} />
        <div className="p-5">
          <EmptyState
            tone="error"
            icon={FileWarning}
            title="Could not read the AP document"
            description={
              <>
                {client.docError ?? "The file could not be parsed."} Upload a text-based copy of{" "}
                <span className="font-medium text-foreground">{client.sourceDoc.fileName}</span> or
                enter {client.name}&rsquo;s rules by hand.
              </>
            }
            action={
              <Button asChild variant="outline">
                <Link to="/clients" search={{ client: client.id }}>
                  Open {client.name}
                </Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  if (!client.requirements) {
    return (
      <>
        <PanelHeader checking={false} />
        <div className="p-5">
          <EmptyState
            icon={ScanSearch}
            title="No AP requirements yet"
            description={`Extract ${client.name}'s rules from their AP document to check this invoice.`}
            action={
              <Button asChild>
                <Link to="/clients" search={{ client: client.id }}>
                  Extract requirements
                </Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  if (!issues) {
    return (
      <>
        <PanelHeader checking />
        <div className="space-y-3 p-5">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </>
    );
  }

  const blockers = issues.filter((i) => i.severity === "blocker");
  const warnings = issues.filter((i) => i.severity === "warning");
  const passed = issues.filter((i) => i.severity === "pass");
  const open = [...blockers, ...warnings];

  return (
    <>
      <PanelHeader issues={issues} checking={checking} />
      <div className="flex-1 space-y-3 p-5">
        {open.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-pass/30 bg-pass-tint p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-pass" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-pass-strong">All checks passed</p>
              <p className="mt-0.5 text-sm text-foreground">
                This invoice meets every rule in {client.name}&rsquo;s AP document.
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Issues to resolve">
            {open.map((issue) => (
              <li key={issue.id}>
                <IssueCard issue={issue} clientName={client.name} onFix={onFix} />
              </li>
            ))}
          </ul>
        )}

        {passed.length > 0 && (
          <div className="rounded-xl border px-4 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Passed checks
            </h3>
            <ul className="mt-2 space-y-1.5">
              {passed.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pass" aria-hidden="true" />
                  <span className="text-foreground">
                    <span className="sr-only">Passed: </span>
                    {p.title}
                    <span className="text-muted-foreground"> · {p.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <SendArea
        blockers={blockers.length}
        warnings={warnings.length}
        checking={checking}
        sending={sending}
        onSend={onSend}
      />
    </>
  );
}
