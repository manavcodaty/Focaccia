import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-magic inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9999px] text-[15px] font-medium tracking-[-0.009em] transition-premium disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[var(--color-graphite)]",
        destructive:
          "bg-[var(--destructive)] text-white shadow-[0_1px_2px_rgba(183,75,51,0.2)] hover:bg-[var(--destructive)]/90",
        ghost:
          "text-[var(--color-muted-stone)] hover:bg-[var(--color-fog)] hover:text-[var(--color-ink)]",
        outline:
          "border border-[var(--color-ink)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-fog)]",
        secondary:
          "bg-[var(--color-fog)] text-[var(--color-ink)] hover:bg-[var(--color-fog)]/80",
        warmAccent:
          "bg-[var(--color-warm-mist)] text-[var(--color-terracotta)] hover:bg-[var(--color-warm-mist)]/80",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-4 text-[13px]",
        lg: "h-11 px-6",
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
