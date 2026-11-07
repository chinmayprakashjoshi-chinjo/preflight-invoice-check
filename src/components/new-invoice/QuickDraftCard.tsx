import { useState, type FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXAMPLE_PROMPT } from "@/lib/parse-draft";

interface QuickDraftCardProps {
  onGenerate: (text: string) => Promise<void>;
}

export function QuickDraftCard({ onGenerate }: QuickDraftCardProps) {
  const [text, setText] = useState(EXAMPLE_PROMPT);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await onGenerate(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-surface p-4 sm:p-5" aria-busy={loading}>
      <label htmlFor="quick-draft" className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        Describe the invoice
      </label>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <input
          id="quick-draft"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Invoice Northwind Studio €950 for brand guidelines refresh"
          className="h-11 w-full min-w-0 flex-1 rounded-md border border-input bg-surface px-3.5 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          disabled={loading}
        />
        <Button type="submit" size="lg" disabled={loading || !text.trim()} className="sm:w-44">
          {loading ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Generating
            </>
          ) : (
            "Generate draft"
          )}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Include the client, the amount and what it is for. You can edit everything afterwards.
      </p>
    </form>
  );
}
