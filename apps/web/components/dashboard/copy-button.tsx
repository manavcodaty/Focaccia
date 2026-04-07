"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({
  label = "Copied to clipboard.",
  value,
}: {
  label?: string;
  value: string;
}) {
  const [didCopy, setDidCopy] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setDidCopy(true);
    toast.success(label);
    window.setTimeout(() => setDidCopy(false), 1800);
  }

  return (
    <Button
      onClick={handleCopy}
      size="sm"
      type="button"
      variant="outline"
      className={didCopy ? "border-[color:var(--success)]/30 bg-[color:var(--success-soft)]/50 text-[color:var(--success)]" : ""}
    >
      {didCopy ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {didCopy ? "Copied" : "Copy"}
    </Button>
  );
}
