import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { markEdited, REQUIREMENT_LABELS } from "@/lib/requirements";
import {
  CURRENCIES,
  PAYMENT_TERMS,
  PaymentTermsSchema,
  type ClientRequirements,
  type Currency,
  type RequirementKey,
} from "@/lib/types";

interface RequirementEditDialogProps {
  requirementKey: RequirementKey | null;
  requirements: ClientRequirements;
  saving: boolean;
  onClose: () => void;
  onSave: (next: ClientRequirements) => void;
}

export function RequirementEditDialog({
  requirementKey,
  requirements,
  saving,
  onClose,
  onSave,
}: RequirementEditDialogProps) {
  const [draft, setDraft] = useState(requirements);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(requirements);
    setError(null);
  }, [requirements, requirementKey]);

  if (!requirementKey) return null;
  const key = requirementKey;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (key === "allowedCurrencies" && draft.allowedCurrencies.length === 0) {
      setError("Choose at least one currency.");
      return;
    }
    if (key === "apEmail" && draft.apEmail && !/^\S+@\S+\.\S+$/.test(draft.apEmail)) {
      setError("Enter a valid email address, or leave it empty.");
      return;
    }
    onSave(markEdited(draft, key));
  }

  const toggleCurrency = (c: Currency, on: boolean) =>
    setDraft((d) => ({
      ...d,
      allowedCurrencies: on
        ? Array.from(new Set([...d.allowedCurrencies, c]))
        : d.allowedCurrencies.filter((x) => x !== c),
    }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Edit requirement</DialogTitle>
            <DialogDescription>
              Correct what PreFlight extracted. Pre-flight checks use your value from now on.
            </DialogDescription>
          </DialogHeader>

          <div>
            <p className="text-sm font-medium text-foreground">{REQUIREMENT_LABELS[key]}</p>
            <div className="mt-3">
              {(key === "poRequired" || key === "vatRequired" || key === "oneInvoicePerFile") && (
                <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                  <span className="text-sm text-foreground">Required</span>
                  <Switch
                    checked={draft[key]}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                  />
                </label>
              )}

              {key === "poRequired" && draft.poRequired && (
                <div className="mt-3">
                  <label htmlFor="open-po" className="text-xs font-medium text-foreground">
                    Open PO number (optional)
                  </label>
                  <Input
                    id="open-po"
                    className="mt-1.5 tabular"
                    value={draft.openPoNumber ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, openPoNumber: e.target.value || undefined }))}
                  />
                </div>
              )}

              {key === "vatRequired" && draft.vatRequired && (
                <div className="mt-3">
                  <label htmlFor="vat-on-file" className="text-xs font-medium text-foreground">
                    VAT ID to print (optional)
                  </label>
                  <Input
                    id="vat-on-file"
                    className="mt-1.5 tabular"
                    value={draft.vatIdOnFile ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, vatIdOnFile: e.target.value || undefined }))}
                  />
                </div>
              )}

              {key === "legalName" && (
                <>
                  <label htmlFor="legal-name" className="sr-only">
                    Legal entity name
                  </label>
                  <Input
                    id="legal-name"
                    value={draft.legalName ?? ""}
                    placeholder="Leave empty if the client does not specify one"
                    onChange={(e) => setDraft((d) => ({ ...d, legalName: e.target.value || undefined }))}
                  />
                </>
              )}

              {key === "apEmail" && (
                <>
                  <label htmlFor="ap-email" className="sr-only">
                    AP inbox email
                  </label>
                  <Input
                    id="ap-email"
                    type="email"
                    value={draft.apEmail ?? ""}
                    placeholder="ap@client.example"
                    onChange={(e) => setDraft((d) => ({ ...d, apEmail: e.target.value || undefined }))}
                  />
                </>
              )}

              {key === "paymentTerms" && (
                <Select
                  value={draft.paymentTerms}
                  onValueChange={(v) => setDraft((d) => ({ ...d, paymentTerms: PaymentTermsSchema.parse(v) }))}
                >
                  <SelectTrigger aria-label="Payment terms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {key === "allowedCurrencies" && (
                <div className="space-y-2">
                  {CURRENCIES.map((c) => (
                    <label key={c} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span className="text-sm text-foreground">{c}</span>
                      <Switch
                        checked={draft.allowedCurrencies.includes(c)}
                        onCheckedChange={(v) => toggleCurrency(c, v)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-blocker-strong">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
