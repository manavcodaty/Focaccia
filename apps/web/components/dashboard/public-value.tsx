"use client";

import { CopyInputButton } from "@/components/dashboard/copy-button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function PublicValue({ label, value }: { label: string; value: string }) {
  const id = `public-value-${label.toLowerCase()}`;
  return (
    <Field>
      <FieldLabel className="font-mono text-xs" htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput className="font-mono text-xs" id={id} readOnly value={value} />
        <InputGroupAddon align="inline-end">
          <CopyInputButton label={`${label} copied.`} name={label} value={value} />
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
