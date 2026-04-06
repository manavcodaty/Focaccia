"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", suffix: "" },
  { label: "Provisioning", suffix: "/provisioning" },
  { label: "Revocations", suffix: "/revocations" },
  { label: "Gate Logs", suffix: "/logs" },
] as const;

export function EventRouteTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Event sections" className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const href = `/events/${eventId}${tab.suffix}`;
        const isActive = pathname === href;

        return (
          <Link
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
              isActive
                ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            )}
            href={href}
            key={tab.label}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
