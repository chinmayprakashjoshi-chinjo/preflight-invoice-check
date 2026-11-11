import { AlertTriangle, Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";

interface SendAreaProps {
  blockers: number;
  warnings: number;
  checking: boolean;
  sending: boolean;
  onSend: () => void;
}

export function SendArea({ blockers, warnings, checking, sending, onSend }: SendAreaProps) {
  const blocked = blockers > 0;

  return (
    <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-4 font-inter font-normal">
      {blocked ? (
        <>
          <Button
            type="button"
            variant="locked"
            size="lg"
            className="w-full h-11 rounded-xl font-normal"
            disabled
            aria-describedby="send-hint"
          >
            <Lock aria-hidden="true" />
            Send via PayPal
          </Button>
          <p id="send-hint" className="mt-2 text-center text-xs font-normal text-slate-500">
            Resolve {pluralize(blockers, "blocker")} before sending
          </p>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="pass"
            size="lg"
            className="w-full h-11 rounded-xl shadow-sm cursor-pointer font-normal"
            onClick={onSend}
            disabled={sending || checking}
          >
            {sending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Sending via PayPal...
              </>
            ) : (
              <>
                <Send aria-hidden="true" />
                Send via PayPal
              </>
            )}
          </Button>
          {warnings > 0 ? (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-normal text-warning-strong">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {pluralize(warnings, "warning")}, you can still send
            </p>
          ) : (
            <p className="mt-2 text-center text-xs font-normal text-muted-foreground">
              Sends through PayPal Sandbox. No real money moves.
            </p>
          )}
        </>
      )}
    </div>
  );
}
