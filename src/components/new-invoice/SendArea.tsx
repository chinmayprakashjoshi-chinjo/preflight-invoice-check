import { AlertTriangle, CheckCircle2, Loader2, Lock } from "lucide-react";
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
    <div className="rounded-b-xl border-t bg-muted/60 px-5 py-4">
      {blocked ? (
        <>
          <Button type="button" variant="locked" size="lg" className="w-full" disabled aria-describedby="send-hint">
            <Lock aria-hidden="true" />
            Resolve {pluralize(blockers, "blocker")} before sending
          </Button>
          <p id="send-hint" className="mt-2 text-center text-xs text-muted-foreground">
            Blockers would get this invoice rejected by the client&rsquo;s AP team.
          </p>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="pass"
            size="lg"
            className="w-full"
            onClick={onSend}
            disabled={sending || checking}
          >
            {sending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Sending via PayPal
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden="true" />
                Cleared for send
              </>
            )}
          </Button>
          {warnings > 0 ? (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-warning-strong">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {pluralize(warnings, "warning")}, you can still send
            </p>
          ) : (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Sends through PayPal Sandbox. No real money moves.
            </p>
          )}
        </>
      )}
    </div>
  );
}
