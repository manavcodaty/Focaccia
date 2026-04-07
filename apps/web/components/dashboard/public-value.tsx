"use client";

import { CopyButton } from "@/components/dashboard/copy-button";
import { cn } from "@/lib/utils";

export function PublicValue({
  label,
  value,
  subtle = false,
}: {
  label: string;
  subtle?: boolean;
  value: string;
}) {
  return (
    <div className="group rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4 transition-colors duration-150 hover:border-[color:var(--border-strong)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-[color:var(--primary)]/60" />
          <span className="token-mono text-xs font-medium text-[color:var(--muted-foreground)]">{label}</span>
        </div>
        <CopyButton label={`${label} copied.`} value={value} />
      </div>
      <p
        className={cn(
          "mt-3 token-mono break-all text-[0.8125rem] leading-6 text-[color:var(--foreground)]",
          subtle && "text-[color:var(--muted-foreground)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
