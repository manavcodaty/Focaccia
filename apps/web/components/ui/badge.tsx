import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[9999px] px-3 py-1 text-[12px] font-medium tracking-[-0.009em] transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-ink)] text-[var(--color-canvas)]",
        outline:
          "border border-[var(--color-hint-of-grey)]/40 text-[var(--color-muted-stone)]",
        primary:
          "bg-[var(--color-ink)] text-[var(--color-canvas)]",
        secondary:
          "bg-[var(--color-fog)] text-[var(--color-muted-stone)]",
        success:
          "bg-[var(--success-soft)] text-[var(--success)]",
        warning:
          "bg-[var(--warning-soft)] text-[var(--warning)]",
        destructive:
          "bg-[var(--danger-soft)] text-[var(--danger)]",
        warmAccent:
          "bg-[var(--color-warm-mist)] text-[var(--color-terracotta)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
