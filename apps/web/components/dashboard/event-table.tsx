"use client";

import Link from "next/link";
import { ChevronRight, CircleDot, Ellipsis, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardEventSummary } from "@/lib/types";

function formatRange(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`;
}

export function EventTable({ events }: { events: DashboardEventSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Window</TableHead>
          <TableHead>Gate</TableHead>
          <TableHead>Revocations</TableHead>
          <TableHead>Logs</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.event_id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/60">
                  <ShieldCheck className="text-[color:var(--primary)]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-[color:var(--foreground)]">{event.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="truncate rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted-foreground)]">
                      {event.event_id}
                    </span>
                    <span className="truncate rounded-full border border-[color:var(--border)] bg-[color:var(--accent)]/55 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--foreground)]">
                      {event.join_code}
                    </span>
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell className="max-w-[22rem] text-sm text-[color:var(--muted-foreground)]">
              {formatRange(event.starts_at, event.ends_at)}
            </TableCell>
            <TableCell>
              <Badge variant={event.pk_gate_event ? "success" : "warning"}>
                {event.pk_gate_event ? "Provisioned" : "Pending"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2.5 py-1 text-xs font-medium">
                <CircleDot className="text-[color:var(--danger)]" />
                {event.revocationCount}
              </div>
            </TableCell>
            <TableCell>
              <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2.5 py-1 text-xs font-medium">
                <CircleDot className="text-[color:var(--primary)]" />
                {event.logCount}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="inline-flex items-center gap-1">
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/events/${event.event_id}`}>
                    Open
                    <ChevronRight data-icon="inline-end" />
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <Ellipsis />
                      <span className="sr-only">Open event actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/events/${event.event_id}`}>Overview</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/events/${event.event_id}/provisioning`}>Provisioning</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/events/${event.event_id}/revocations`}>Revocations</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/events/${event.event_id}/logs`}>Gate Logs</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
