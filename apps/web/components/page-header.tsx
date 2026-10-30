import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  actions,
  children,
  className,
  description,
  title,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4 px-4 lg:px-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
