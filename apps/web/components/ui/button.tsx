import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[0_18px_44px_-24px_rgba(0,102,255,0.52)] hover:-translate-y-0.5 hover:bg-[color:var(--primary-strong)]",
        ghost:
          "text-[color:var(--foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)]",
        outline:
          "border border-[color:var(--border)] bg-transparent text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:bg-[color:var(--accent)]",
        secondary:
          "bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] hover:bg-[color:var(--secondary)]/80",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-sm",
        icon: "size-10",
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
