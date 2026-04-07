"use client";

import Link from "next/link";
import { ChevronRight, Ellipsis, ShieldCheck } from "lucide-react";

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

  return `${formatter.format(new Date(startsAt))} — ${formatter.format(new Date(endsAt))}`;
}

export function EventTable({ events }: { events: DashboardEventSummary[] }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
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
            <TableRow key={event.event_id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--accent)]/40">
                    <ShieldCheck className="size-4 text-[color:var(--primary)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[color:var(--foreground)]">{event.name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="token-mono truncate text-[0.6875rem] text-[color:var(--muted-foreground)]">
                        {event.event_id}
                      </span>
                      <span className="text-[color:var(--border-strong)]">·</span>
                      <span className="token-mono text-[0.6875rem] font-medium text-[color:var(--primary)]/80">
                        {event.join_code}
                      </span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-[20rem] text-[0.8125rem] text-[color:var(--muted-foreground)]">
                {formatRange(event.starts_at, event.ends_at)}
              </TableCell>
              <TableCell>
                <Badge variant={event.pk_gate_event ? "success" : "warning"}>
                  {event.pk_gate_event ? "Provisioned" : "Pending"}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="token-mono text-sm text-[color:var(--foreground)]">
                  {event.revocationCount}
                </span>
              </TableCell>
              <TableCell>
                <span className="token-mono text-sm text-[color:var(--foreground)]">
                  {event.logCount}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-0.5">
                  <Button asChild size="sm" variant="ghost" className="text-[color:var(--primary)]">
                    <Link href={`/events/${event.event_id}`}>
                      Open
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-8">
                        <Ellipsis className="size-4" />
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
    </div>
  );
}
