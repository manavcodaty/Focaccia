import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-[color:var(--input)] bg-[color:var(--card)]/85 px-3.5 py-2.5 text-sm text-[color:var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all outline-none placeholder:text-[color:var(--muted-foreground)] focus-visible:border-[color:var(--primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/45 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
