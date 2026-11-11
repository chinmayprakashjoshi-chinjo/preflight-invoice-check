import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium cursor-pointer transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow font-semibold",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 font-semibold",
        outline:
          "border border-border bg-surface text-foreground shadow-2xs hover:bg-muted hover:text-foreground font-medium",
        secondary:
          "border border-border bg-surface text-foreground shadow-2xs hover:bg-muted font-medium",
        ghost: "text-foreground hover:bg-muted font-medium",
        link: "text-primary underline-offset-4 hover:underline font-medium",
        tint: "bg-primary-tint text-primary hover:bg-primary/15 font-medium transition-colors",
        pass: "bg-pass-strong text-primary-foreground shadow-sm hover:bg-pass-strong/90 font-semibold",
        locked:
          "border border-border bg-muted/80 text-muted-foreground shadow-none disabled:opacity-100 disabled:cursor-not-allowed",
      },
      size: {
        default: "h-9.5 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-5 text-sm font-semibold",
        icon: "h-9.5 w-9.5",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
