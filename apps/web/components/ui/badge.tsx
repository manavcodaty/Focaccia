import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--foreground)]",
        outline:
          "border-[color:var(--border)] bg-transparent text-[color:var(--foreground)]",
        success:
          "border-emerald-300/70 bg-emerald-500/10 text-emerald-700",
        warning:
          "border-amber-300/80 bg-amber-500/10 text-amber-700",
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
