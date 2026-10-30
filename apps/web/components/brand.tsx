import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/** PrivatePass mark: an admission ticket with an F punched through it. */
export function PrivatePassMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" className={cn("size-5", className)} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        clipRule="evenodd"
        d="M5 3h14a2 2 0 0 1 2 2v4.5a2.5 2.5 0 0 0 0 5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.5a2.5 2.5 0 0 0 0-5V5a2 2 0 0 1 2-2Zm4 4v10h2.25v-3.75h3.75v-2h-3.75V9H16V7H9Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function Wordmark({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <PrivatePassMark />
      <span className="text-[15px] font-semibold tracking-tight">PrivatePass</span>
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </span>
  );
}
