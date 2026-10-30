"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", suffix: "" },
  { label: "Gate setup", suffix: "/provisioning" },
  { label: "Revocations", suffix: "/revocations" },
  { label: "Gate logs", suffix: "/logs" },
] as const;

/** Section navigation for one event. Real links (not ARIA tabs), because each section is its own route. */
export function EventRouteTabs({ counts, eventId }: { counts?: Partial<Record<"/revocations" | "/logs", number>>; eventId: string }) {
  const pathname = usePathname();
  const base = `/events/${encodeURIComponent(eventId)}`;
  const current = tabs.find((tab) => tab.suffix && pathname.endsWith(tab.suffix))?.suffix ?? "";

  return (
    <nav aria-label="Event sections" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 pb-px">
      {tabs.map((tab) => {
        const active = current === tab.suffix;
        const count = tab.suffix === "/revocations" || tab.suffix === "/logs" ? counts?.[tab.suffix] : undefined;
        return (
          <Button
            asChild
            className={cn(
              "relative rounded-b-none after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
              active ? "text-foreground after:bg-foreground" : "text-muted-foreground",
            )}
            key={tab.label}
            size="sm"
            variant="ghost"
          >
            <Link aria-current={active ? "page" : undefined} href={`${base}${tab.suffix}`}>
              {tab.label}
              {count ? <span className="text-sm tabular-nums">{count}</span> : null}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
