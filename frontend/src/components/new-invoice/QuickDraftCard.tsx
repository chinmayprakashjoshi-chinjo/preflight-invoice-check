import { useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXAMPLE_PROMPT } from "@/lib/parse-draft";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/types";

interface QuickDraftCardProps {
  onGenerate: (text: string) => Promise<void>;
  lockedAmount?: number | null | undefined;
  lockedCurrency?: Currency | string | null | undefined;
  isGenerating?: boolean;
}

export function QuickDraftCard({
  onGenerate,
  lockedAmount,
  lockedCurrency,
  isGenerating,
}: QuickDraftCardProps) {
  const [text, setText] = useState(EXAMPLE_PROMPT);
  const [loading, setLoading] = useState(false);

  const isBusy = loading || Boolean(isGenerating);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    setLoading(true);
    try {
      await onGenerate(text);
    } catch (err) {
      console.error("[QuickDraftCard] onGenerate failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const isLocked = lockedAmount !== undefined && lockedAmount !== null && lockedAmount > 0;

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
      aria-busy={isBusy}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="quick-draft" className="text-sm font-semibold text-slate-900">
          Describe the invoice in one line
        </label>
        {isLocked && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/90 bg-indigo-50/90 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-2xs transition-all"
            title={`Net-landing calculation locked at ${formatMoney(lockedAmount, lockedCurrency || "USD")}.`}
          >
            <Lock className="size-3 text-indigo-600" aria-hidden="true" />
            <span>🔒 Net-Landing Price Locked</span>
            <span className="font-bold text-indigo-900">
              ({formatMoney(lockedAmount, lockedCurrency || "USD")})
            </span>
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <input
          id="quick-draft"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Invoice Northwind Studio €950 for brand guidelines refresh"
          className="h-11 w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm text-slate-900 shadow-2xs transition-all placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/10"
          disabled={isBusy}
        />
        <Button
          type="submit"
          size="lg"
          disabled={isBusy || !text.trim()}
          className="sm:w-44 shadow-sm font-semibold cursor-pointer"
        >
          {isBusy ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Generating...
            </>
          ) : (
            "Generate draft"
          )}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {isLocked
          ? `Your net-landing amount (${formatMoney(lockedAmount, lockedCurrency || "USD")}) is locked. The AI generator will fill client and deliverables while keeping this calculation safe.`
          : "Include the client, the amount and what it is for. You can edit everything afterwards."}
      </p>
    </form>
  );
}
