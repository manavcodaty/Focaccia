import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-12 w-full rounded-2xl border border-[color:var(--input)] bg-[color:var(--background)]/80 px-4 py-2 text-sm text-[color:var(--foreground)] shadow-sm transition-colors outline-none placeholder:text-[color:var(--muted-foreground)] focus-visible:border-[color:var(--primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        type={type}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
