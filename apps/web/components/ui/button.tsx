import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[0_1px_2px_rgba(0,102,255,0.2),0_4px_12px_-2px_rgba(0,102,255,0.24)] hover:bg-[color:var(--primary-strong)] hover:shadow-[0_1px_2px_rgba(0,102,255,0.24),0_6px_16px_-2px_rgba(0,102,255,0.3)] active:scale-[0.98] active:shadow-[0_1px_2px_rgba(0,102,255,0.16)]",
        destructive:
          "bg-[color:var(--destructive)] text-white shadow-[0_1px_2px_rgba(183,75,51,0.2)] hover:bg-[color:var(--destructive)]/90 active:scale-[0.98]",
        ghost:
          "text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)]/80 hover:text-[color:var(--foreground)]",
        outline:
          "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] shadow-[var(--shadow-card)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--accent)]/40 active:scale-[0.98]",
        secondary:
          "bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] shadow-[0_1px_2px_rgba(10,16,36,0.12)] hover:bg-[color:var(--secondary)]/90 active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, size, variant, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ className, size, variant }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
