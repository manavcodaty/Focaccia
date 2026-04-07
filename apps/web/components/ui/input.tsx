import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-10 w-full rounded-xl border border-[color:var(--input)] bg-[color:var(--card)] px-3.5 py-2 text-sm text-[color:var(--foreground)] shadow-[var(--shadow-inset)] transition-all duration-200 outline-none placeholder:text-[color:var(--muted-foreground)]/60 focus-visible:border-[color:var(--primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-40",
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
