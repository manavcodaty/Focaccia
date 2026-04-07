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
    <nav aria-label="Event sections" className="flex items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-1">
      {tabs.map((tab) => {
        const href = `/events/${eventId}${tab.suffix}`;
        const isActive = pathname === href;

        return (
          <Link
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-[color:var(--card)] text-[color:var(--foreground)] shadow-[var(--shadow-card)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
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
