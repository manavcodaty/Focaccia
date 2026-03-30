"use client";

import { CopyButton } from "@/components/dashboard/copy-button";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)]/75 p-4">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline">{label}</Badge>
        <CopyButton label={`${label} copied.`} value={value} />
      </div>
      <p
        className={cn(
          "break-all font-mono text-sm leading-7 text-[color:var(--foreground)]",
          subtle && "text-[color:var(--muted-foreground)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
