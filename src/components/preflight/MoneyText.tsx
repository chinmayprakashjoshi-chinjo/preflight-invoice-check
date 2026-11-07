import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MoneyTextProps {
  amount: number;
  currency: Currency;
  /** "accent" uses the teal money colour. Large sizes use the brighter teal, small the darker. */
  tone?: "default" | "accent" | "muted";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClass = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl font-semibold tracking-tight",
  xl: "text-4xl font-semibold tracking-tight",
};

export function MoneyText({
  amount,
  currency,
  tone = "default",
  size = "sm",
  className,
}: MoneyTextProps) {
  const large = size === "lg" || size === "xl";
  const toneClass =
    tone === "accent"
      ? large
        ? "text-money"
        : "text-money-strong"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <span className={cn("tabular", sizeClass[size], toneClass, className)}>
      {formatMoney(amount, currency)}
    </span>
  );
}
