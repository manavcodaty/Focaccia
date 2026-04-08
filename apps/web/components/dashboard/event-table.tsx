"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Ellipsis, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { getEventLifecycleState, type EventLifecyclePhase } from "@/lib/event-lifecycle";
import { invokeEdgeFunction } from "@/lib/functions";
import type { DashboardEventSummary } from "@/lib/types";

function formatRange(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(new Date(startsAt))} — ${formatter.format(new Date(endsAt))}`;
}

function getEventPhaseBadge(phase: EventLifecyclePhase) {
  switch (phase) {
    case "active":
      return {
        label: "Live",
        variant: "primary" as const,
      };
    case "ended":
      return {
        label: "Ended",
        variant: "warning" as const,
      };
    case "upcoming":
    default:
      return {
        label: "Upcoming",
        variant: "outline" as const,
      };
  }
}

function getGateBadge(event: DashboardEventSummary, phase: EventLifecyclePhase) {
  if (phase === "ended") {
    return {
      label: event.pk_gate_event ? "Inactive" : "Closed",
      variant: "warning" as const,
    };
  }

  return {
    label: event.pk_gate_event ? "Provisioned" : "Pending",
    variant: event.pk_gate_event ? "success" as const : "warning" as const,
  };
}

function DeleteEventMenuItem({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const router = useRouter();
  const { supabase, user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken || !user) {
      setIsDeleting(false);
      toast.error("Your organizer session is missing. Sign in again.");
      return;
    }

    try {
      await invokeEdgeFunction<{ event_id: string }>({
        accessToken,
        body: {
          event_id: eventId,
        },
        name: "delete-event",
      });

      setIsOpen(false);
      toast.success("Event deleted.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete event.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem
        className="text-[color:var(--danger)] focus:bg-[color:var(--danger-soft)] focus:text-[color:var(--danger)]"
        onSelect={(event) => {
          event.preventDefault();
          setIsOpen(true);
        }}
      >
        Delete event
        <Trash2 className="size-4" />
      </DropdownMenuItem>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <span className="font-medium text-[color:var(--foreground)]">{eventName}</span> and
            permanently remove its join code, gate binding, revocations, gate logs, and server-side secrets.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-[color:var(--danger)] text-white hover:bg-[color:var(--danger)]/90"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
          >
            {isDeleting ? "Deleting event…" : "Delete event"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
          {events.map((event) => {
            const lifecycle = getEventLifecycleState(event);
            const phaseBadge = getEventPhaseBadge(lifecycle.phase);
            const gateBadge = getGateBadge(event, lifecycle.phase);

            return (
              <TableRow key={event.event_id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--accent)]/40">
                      <ShieldCheck className="size-4 text-[color:var(--primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-[color:var(--foreground)]">{event.name}</p>
                        <Badge variant={phaseBadge.variant}>{phaseBadge.label}</Badge>
                      </div>
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
                  <Badge variant={gateBadge.variant}>
                    {gateBadge.label}
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
                        <DropdownMenuSeparator />
                        <DeleteEventMenuItem eventId={event.event_id} eventName={event.name} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
