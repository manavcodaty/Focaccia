import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[0.6875rem] font-medium tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--border)] bg-[color:var(--muted)]/70 text-[color:var(--foreground)]",
        outline:
          "border-[color:var(--border)] bg-transparent text-[color:var(--muted-foreground)]",
        success:
          "border-[color:var(--success)]/20 bg-[color:var(--success-soft)] text-[color:var(--success)]",
        warning:
          "border-[color:var(--warning)]/20 bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
        danger:
          "border-[color:var(--danger)]/20 bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
        primary:
          "border-[color:var(--primary)]/15 bg-[color:var(--accent)] text-[color:var(--primary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ className, variant }))} {...props} />;
}

export { Badge, badgeVariants };
