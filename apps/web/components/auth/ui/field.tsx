"use client";

import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("group/field-group flex w-full flex-col gap-7", className)}
      {...props}
    />
  );
}

const fieldVariants = cva("group/field flex w-full gap-3", {
  defaultVariants: {
    orientation: "vertical",
  },
  variants: {
    orientation: {
      vertical: "flex-col [&>*]:w-full",
    },
  },
});

function Field({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn("flex w-fit gap-2 leading-snug", className)}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-muted-foreground text-sm font-normal leading-normal [&>button:hover]:text-primary [&>button]:underline [&>button]:underline-offset-4",
        className,
      )}
      {...props}
    />
  );
}

export { Field, FieldDescription, FieldGroup, FieldLabel };
