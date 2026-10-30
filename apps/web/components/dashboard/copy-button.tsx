"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputGroupButton } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyText } from "@/lib/copy-text";

function useCopy(value: string, label: string) {
  const [didCopy, setDidCopy] = useState(false);
  async function copy() {
    try {
      await copyText(value);
      setDidCopy(true);
      toast.success(label);
      window.setTimeout(() => setDidCopy(false), 1600);
    } catch {
      toast.error("Clipboard unavailable. Select the value and copy it manually.");
    }
  }
  return { copy, didCopy };
}

export function CopyButton({ label = "Copied to clipboard.", value }: { label?: string; value: string }) {
  const { copy, didCopy } = useCopy(value, label);
  return (
    <Button onClick={() => void copy()} type="button" variant="outline">
      {didCopy ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {didCopy ? "Copied" : "Copy"}
    </Button>
  );
}

/** Icon-only copy control for use inside an InputGroupAddon. */
export function CopyInputButton({ label = "Copied to clipboard.", name, value }: { label?: string; name: string; value: string }) {
  const { copy, didCopy } = useCopy(value, label);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <InputGroupButton aria-label={`Copy ${name}`} onClick={() => void copy()} size="icon-xs">
          {didCopy ? <CheckIcon /> : <CopyIcon />}
        </InputGroupButton>
      </TooltipTrigger>
      <TooltipContent>{didCopy ? "Copied" : `Copy ${name}`}</TooltipContent>
    </Tooltip>
  );
}
