"use client";

import Link from "next/link";
import { MoreHorizontal, ShieldCheck } from "lucide-react";

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

  return `${formatter.format(new Date(startsAt))} -> ${formatter.format(new Date(endsAt))}`;
}

export function EventTable({ events }: { events: DashboardEventSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Event ID</TableHead>
          <TableHead>Window</TableHead>
          <TableHead>Gate</TableHead>
          <TableHead>Revocations</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.event_id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
                  <ShieldCheck className="size-4 text-[color:var(--primary)]" />
                </div>
                <div>
                  <div className="font-medium text-[color:var(--foreground)]">{event.name}</div>
                  <div className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                    {event.join_code}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              {event.event_id}
            </TableCell>
            <TableCell className="text-sm text-[color:var(--muted-foreground)]">
              {formatRange(event.starts_at, event.ends_at)}
            </TableCell>
            <TableCell>
              <Badge variant={event.pk_gate_event ? "success" : "warning"}>
                {event.pk_gate_event ? "Provisioned" : "Pending"}
              </Badge>
            </TableCell>
            <TableCell>{event.revocationCount}</TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Open event actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/events/${event.event_id}`}>Open overview</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/events/${event.event_id}/provisioning`}>Open provisioning</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
