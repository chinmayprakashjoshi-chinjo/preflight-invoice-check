import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  FilePlus2,
  FileWarning,
  Mail,
  ScanSearch,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentDropzone } from "@/components/clients/DocumentDropzone";
import { RequirementEditDialog } from "@/components/clients/RequirementEditDialog";
import { RequirementsTable } from "@/components/clients/RequirementsTable";
import { EmptyState } from "@/components/preflight/EmptyState";
import { PageHeader } from "@/components/preflight/PageHeader";
import { extractRequirements, learnFromEmail, updateRequirements } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { clientsQuery } from "@/lib/queries";
import { requirementRows } from "@/lib/requirements";
import type { Client, ClientRequirements, RequirementKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/clients")({
  validateSearch: (search: Record<string, unknown>): { client?: string | undefined } => ({
    client: typeof search["client"] === "string" ? search["client"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Clients · PreFlight" },
      {
        name: "description",
        content: "Each client's accounts-payable requirements, extracted from their AP documents.",
      },
      { property: "og:title", content: "Clients · PreFlight" },
      {
        property: "og:description",
        content: "Each client's accounts-payable requirements, extracted from their AP documents.",
      },
    ],
  }),
  component: ClientsPage,
});

function DocStatusLabel({ client }: { client: Client }) {
  if (client.docStatus === "error")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blocker-strong">
        <AlertCircle className="size-3.5" aria-hidden="true" />
        Document unreadable
      </span>
    );
  if (client.docStatus === "not_extracted" || !client.requirements)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ScanSearch className="size-3.5" aria-hidden="true" />
        Not extracted
      </span>
    );
  const count = Object.keys(client.requirements.meta).length;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-pass-strong">
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
      {pluralize(count, "requirement")}
    </span>
  );
}

function ClientsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const q = useQuery(clientsQuery);
  const clients = q.data ?? [];
  const selectedId = search.client ?? clients[0]?.id;
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="PreFlight reads each client's AP or vendor guide and turns it into checks your invoices must pass."
        actions={
          <Button asChild>
            <Link to="/app/new-invoice">
              <FilePlus2 aria-hidden="true" />
              New invoice
            </Link>
          </Button>
        }
      />

      {q.isError ? (
        <EmptyState
          tone="error"
          icon={AlertCircle}
          title="Could not load clients"
          description="Check your connection and try again."
          action={
            <Button variant="outline" onClick={() => q.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 wide:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Clients" className="rounded-xl border bg-surface p-2">
            {q.isPending ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <EmptyState icon={Users} title="No clients yet" className="border-0" />
            ) : (
              <ul className="space-y-1">
                {clients.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => navigate({ to: ".", search: { client: c.id } })}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                          active ? "bg-primary-tint" : "hover:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-neutral-strong",
                          )}
                          aria-hidden="true"
                        >
                          {c.name.charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm font-medium",
                              active ? "text-primary" : "text-foreground",
                            )}
                          >
                            {c.name}
                          </span>
                          <DocStatusLabel client={c} />
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          {q.isPending ? (
            <div className="space-y-4 rounded-xl border bg-surface p-6">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : selected ? (
            <ClientDetail key={selected.id} client={selected} />
          ) : (
            <EmptyState
              icon={Users}
              title="Choose a client"
              description="Pick a client on the left to see their AP requirements."
            />
          )}
        </div>
      )}
    </div>
  );
}

function ClientDetail({ client }: { client: Client }) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(client.sourceDoc.fileName);
  const [editing, setEditing] = useState<RequirementKey | null>(null);

  useEffect(() => setFileName(client.sourceDoc.fileName), [client.sourceDoc.fileName]);

  const replaceClient = (updated: Client) =>
    queryClient.setQueryData<Client[]>(clientsQuery.queryKey, (prev) =>
      prev?.map((c) => (c.id === updated.id ? updated : c)),
    );

  const [email, setEmail] = useState("");
  const learn = useMutation({
    mutationFn: () => learnFromEmail({ clientId: client.id, text: email }),
    onSuccess: (updated) => {
      replaceClient(updated);
      setEmail("");
      toast.success("Requirement learned from the email", {
        description: "It is marked New in the table below.",
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that email."),
  });

  const extract = useMutation({
    mutationFn: (input: { fileName?: string | undefined; text?: string | undefined }) =>
      extractRequirements({ clientId: client.id, ...input }),
    onSuccess: (updated, variables) => {
      replaceClient(updated);
      if (updated.docStatus === "error") {
        toast.error("Document unreadable", { description: updated.docError });
        return;
      }
      const sourceLabel = variables?.text?.trim()
        ? "pasted text"
        : (variables?.fileName || updated.sourceDoc?.fileName || "uploaded document");
      toast.success("Requirements extracted", {
        description: `${pluralize(Object.keys(updated.requirements?.meta ?? {}).length, "requirement")} found in ${sourceLabel}.`,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the AP document."),
  });

  const save = useMutation({
    mutationFn: (req: ClientRequirements) => updateRequirements(client.id, req, editing ?? undefined),
    onSuccess: (updated) => {
      replaceClient(updated);
      queryClient.invalidateQueries({ queryKey: clientsQuery.queryKey });
      setEditing(null);
      toast.success("Requirement updated in database");
    },
    onError: () => toast.error("Could not save the change. Try again."),
  });

  const rows = client.requirements ? requirementRows(client.requirements) : [];

  return (
    <section aria-labelledby="client-title" className="rounded-xl border bg-surface">
      <div className="flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="client-title" className="text-lg font-semibold text-foreground">
            {client.name}
          </h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden="true" />
              {client.industry}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden="true" />
              {client.contactEmail}
            </span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/new-invoice">
            <FilePlus2 aria-hidden="true" />
            Invoice this client
          </Link>
        </Button>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Source document</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {client.sourceDoc.kind} · {pluralize(client.sourceDoc.pages, "page")}
          </p>
          <div className="mt-3">
            <DocumentDropzone
              fileName={fileName}
              extracting={extract.isPending}
              hasRequirements={Boolean(client.requirements)}
              onFile={(name) => {
                setFileName(name);
                toast(`${name} ready`, { description: "Click Extract requirements to read it." });
              }}
              onExtractFile={() => extract.mutate({ fileName: fileName ?? undefined })}
              onExtractText={(text) => extract.mutate({ text })}
            />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">AP requirements</h3>
            {rows.length > 0 && !extract.isPending && (
              <p className="text-xs text-muted-foreground">
                Check each value against the quote. Edit anything that looks wrong.
              </p>
            )}
          </div>
          <div className="mt-3">
            {extract.isPending ? (
              <div className="space-y-2 rounded-lg border p-4" aria-busy="true">
                <p className="text-sm text-muted-foreground">
                  Reading {pluralize(client.sourceDoc.pages, "page")} and looking for invoicing
                  rules
                </p>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : client.docStatus === "error" ? (
              <EmptyState
                tone="error"
                icon={FileWarning}
                title="Document unreadable"
                description={`${client.docError ?? "The file could not be parsed."} Upload a PDF or paste the text instead.`}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={ScanSearch}
                title="No requirements extracted yet"
                description="Upload the client's AP or vendor guide, then extract its rules."
              />
            ) : (
              <RequirementsTable rows={rows} onEdit={setEditing} />
            )}
          </div>
        </div>
      </div>

      {client.requirements && (
        <div className="border-t p-6">
          <h3 className="text-sm font-semibold text-foreground">Paste a rejection email</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            If this client bounced an invoice, paste their email and PreFlight adds the rule it
            teaches.
          </p>
          <label htmlFor="rejection-email" className="sr-only">
            Rejection email text
          </label>
          <Textarea
            id="rejection-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            rows={4}
            className="mt-3"
            placeholder="Your invoice was returned. All invoices must include a valid PO number."
          />
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              onClick={() => learn.mutate()}
              disabled={!email.trim() || learn.isPending}
            >
              {learn.isPending ? "Learning" : "Learn from this email"}
            </Button>
          </div>
        </div>
      )}

      {client.requirements && (
        <RequirementEditDialog
          requirementKey={editing}
          requirements={client.requirements}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(next) => save.mutate(next)}
        />
      )}
    </section>
  );
}
