import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--card-foreground)]",
        destructive:
          "border-[color:var(--danger)]/20 bg-[color:var(--danger-soft)]/60 text-[color:var(--danger)] [&>svg]:text-[color:var(--danger)]",
        success:
          "border-[color:var(--success)]/20 bg-[color:var(--success-soft)]/60 text-[color:var(--success)] [&>svg]:text-[color:var(--success)]",
        warning:
          "border-[color:var(--warning)]/20 bg-[color:var(--warning-soft)]/60 text-[color:var(--warning)] [&>svg]:text-[color:var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ className, variant }))} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-[0.8125rem] leading-relaxed [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle };
