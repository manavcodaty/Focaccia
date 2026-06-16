import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-ink/10 bg-canvas px-4 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-hint focus:border-ink focus:ring-4 focus:ring-ink/[0.04]",
        className,
      )}
      {...props}
    />
  );
}
