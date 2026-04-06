import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "group/input-group flex min-h-11 w-full items-stretch rounded-xl border border-[color:var(--input)] bg-[color:var(--card)]/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] focus-within:border-[color:var(--primary)] focus-within:ring-2 focus-within:ring-[color:var(--ring)]/45",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> & { align?: "end" | "start" }) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        "flex items-center px-2",
        "data-[align=end]:order-last data-[align=start]:order-first",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-text"
      className={cn(
        "flex items-center text-sm text-[color:var(--muted-foreground)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupButton({
  className,
  size = "sm",
  type = "button",
  variant = "ghost",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> & {
  size?: "default" | "icon" | "lg" | "sm";
}) {
  return (
    <Button
      className={cn("rounded-lg", className)}
      data-slot="input-group-button"
      size={size}
      type={type}
      variant={variant}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "h-auto flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "min-h-24 flex-1 resize-none rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
