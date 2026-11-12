import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { markPaid, recordCreatedInvoice } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { invoicesQuery } from "@/lib/queries";
import { seedInvoices } from "@/mocks/invoices";
import type { InvoiceRecord, InvoiceStatus } from "@/lib/types";

const STORAGE_KEY = "preflight_master_invoices";

function loadSavedInvoices(): InvoiceRecord[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}

function saveInvoices(invoices: InvoiceRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  } catch {
    // Ignore storage quota errors
  }
}

export interface InvoicesContextValue {
  invoices: InvoiceRecord[];
  isLoading: boolean;
  isError: boolean;
  pendingId: string | null;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  markInvoicePaid: (invoiceOrId: InvoiceRecord | string) => Promise<void>;
  addInvoice: (invoice: InvoiceRecord) => void;
  refetch: () => Promise<void>;
}

const InvoicesContext = createContext<InvoicesContextValue | null>(null);

export function InvoicesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const invoicesQ = useQuery(invoicesQuery);

  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => {
    const saved = loadSavedInvoices();
    if (saved && saved.length > 0) return saved;
    return seedInvoices();
  });

  const [pendingId, setPendingId] = useState<string | null>(null);

  // Sync with query data when available from server, preserving local status updates
  useEffect(() => {
    if (invoicesQ.data && invoicesQ.data.length > 0) {
      setInvoices((prev) => {
        const serverInvoices = invoicesQ.data!;
        const merged = serverInvoices.map((serverInv) => {
          const localMatch = prev.find(
            (p) => p.id === serverInv.id || p.number === serverInv.number,
          );
          if (localMatch && localMatch.status !== serverInv.status) {
            // Keep the user's latest local status update
            return {
              ...serverInv,
              status: localMatch.status,
              updatedNote: localMatch.updatedNote,
            };
          }
          return serverInv;
        });

        // Also preserve locally added invoices that are not on the server yet
        for (const localInv of prev) {
          if (!merged.some((m) => m.id === localInv.id || m.number === localInv.number)) {
            merged.unshift(localInv);
          }
        }

        saveInvoices(merged);
        return merged;
      });
    }
  }, [invoicesQ.data]);

  // Persist master state to session storage whenever invoices change
  useEffect(() => {
    saveInvoices(invoices);
  }, [invoices]);

  const updateInvoiceStatus = useCallback(
    async (id: string, status: InvoiceStatus) => {
      setPendingId(id);
      let targetInvoice: InvoiceRecord | undefined;

      setInvoices((prev) => {
        const next = prev.map((inv) => {
          if (inv.id === id || inv.number === id) {
            targetInvoice = {
              ...inv,
              status,
              updatedNote: status === "paid" ? "Paid via sandbox" : inv.updatedNote,
            };
            return targetInvoice;
          }
          return inv;
        });
        saveInvoices(next);
        return next;
      });

      // Synchronously update React Query cache so any raw query consumers stay in sync
      queryClient.setQueryData<InvoiceRecord[]>(invoicesQuery.queryKey, (prev) =>
        prev
          ? prev.map((i) =>
              i.id === id || i.number === id
                ? {
                    ...i,
                    status,
                    updatedNote: status === "paid" ? "Paid via sandbox" : i.updatedNote,
                  }
                : i,
            )
          : undefined,
      );

      try {
        if (status === "paid") {
          await markPaid(id);
        }
        if (targetInvoice) {
          toast.success(
            status === "paid"
              ? "INVOICING.INVOICE.PAID recorded in sandbox"
              : `Invoice status updated to ${status}`,
            {
              description: `${targetInvoice.number} · ${formatMoney(targetInvoice.amount, targetInvoice.currency)} from ${targetInvoice.clientName}`,
            },
          );
        }
      } catch (err) {
        console.warn("[InvoicesContext] Server update failed, local status retained:", err);
      } finally {
        setPendingId(null);
      }
    },
    [queryClient],
  );

  const markInvoicePaid = useCallback(
    async (invoiceOrId: InvoiceRecord | string) => {
      const id = typeof invoiceOrId === "string" ? invoiceOrId : invoiceOrId.id;
      await updateInvoiceStatus(id, "paid");
    },
    [updateInvoiceStatus],
  );

  const addInvoice = useCallback(
    (newInvoice: InvoiceRecord) => {
      setInvoices((prev) => {
        const filtered = prev.filter(
          (i) => i.id !== newInvoice.id && i.number !== newInvoice.number,
        );
        const updated = [newInvoice, ...filtered];
        saveInvoices(updated);
        return updated;
      });

      recordCreatedInvoice(newInvoice);

      queryClient.setQueryData<InvoiceRecord[]>(invoicesQuery.queryKey, (prev) => [
        newInvoice,
        ...(prev ? prev.filter((i) => i.id !== newInvoice.id && i.number !== newInvoice.number) : []),
      ]);
    },
    [queryClient],
  );

  const refetch = useCallback(async () => {
    await invoicesQ.refetch();
  }, [invoicesQ]);

  const value: InvoicesContextValue = {
    invoices,
    isLoading: invoicesQ.isLoading && invoices.length === 0,
    isError: invoicesQ.isError && invoices.length === 0,
    pendingId,
    updateInvoiceStatus,
    markInvoicePaid,
    addInvoice,
    refetch,
  };

  return <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>;
}

export function useInvoices(): InvoicesContextValue {
  const context = useContext(InvoicesContext);
  if (!context) {
    throw new Error("useInvoices must be used within an InvoicesProvider");
  }
  return context;
}
