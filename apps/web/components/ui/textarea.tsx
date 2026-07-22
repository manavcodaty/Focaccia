import { forwardRef, type ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    data-slot="textarea"
    className={cn(
      "flex field-sizing-content min-h-24 w-full resize-y rounded-[var(--radius-field)] border border-input bg-card px-3 py-3 text-base transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-sm",
      className
    )}
    {...props}
  />
))

Textarea.displayName = "Textarea"

export { Textarea }
