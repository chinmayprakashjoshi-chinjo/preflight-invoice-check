import { AlertTriangle, Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";

interface SendAreaProps {
  blockers: number;
  warnings: number;
  checking: boolean;
  sending: boolean;
  canSend?: boolean;
  total?: number;
  onSend: () => void;
}

export function SendArea({
  blockers,
  warnings,
  checking,
  sending,
  canSend = true,
  total,
  onSend,
}: SendAreaProps) {
  const blocked = blockers > 0;
  const zeroTotal = total !== undefined && total <= 0;

  return (
    <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-5 font-inter font-normal">
      {blocked ? (
        <>
          <Button
            type="button"
            variant="locked"
            size="lg"
            className="w-full h-12 rounded-xl text-base font-semibold opacity-50 cursor-not-allowed"
            disabled={true}
            aria-describedby="send-hint"
          >
            <Lock aria-hidden="true" className="size-4" />
            Resolve {blockers} {blockers === 1 ? "Blocker" : "Blockers"} to Send
          </Button>
          <p id="send-hint" className="mt-2.5 text-center text-sm font-medium text-slate-500">
            Resolve {pluralize(blockers, "blocker")} before sending
          </p>
        </>
      ) : zeroTotal ? (
        <>
          <Button
            type="button"
            variant="locked"
            size="lg"
            className="w-full h-12 rounded-xl text-base font-semibold opacity-50 cursor-not-allowed"
            disabled={true}
            aria-describedby="send-hint"
          >
            <Lock aria-hidden="true" className="size-4" />
            Send via PayPal Sandbox
          </Button>
          <p id="send-hint" className="mt-2.5 text-center text-sm font-medium text-amber-600">
            Enter a line item amount before sending
          </p>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="pass"
            size="lg"
            className="w-full h-12 rounded-xl text-base font-semibold shadow-sm hover:shadow-md cursor-pointer transition-all"
            onClick={onSend}
            disabled={!canSend || sending || checking}
          >
            {sending ? (
              <>
                <Loader2 className="animate-spin size-4" aria-hidden="true" />
                Sending via PayPal Sandbox...
              </>
            ) : (
              <>
                <Send aria-hidden="true" className="size-4" />
                Send via PayPal Sandbox
              </>
            )}
          </Button>
          {warnings > 0 ? (
            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-sm font-medium text-warning-strong">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {pluralize(warnings, "warning")}, you can still send
            </p>
          ) : (
            <p className="mt-2.5 text-center text-sm font-medium text-muted-foreground">
              Sends through PayPal Sandbox. No real money moves.
            </p>
          )}
        </>
      )}
    </div>
  );
}
