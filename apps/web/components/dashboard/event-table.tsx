"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, Ellipsis, ExternalLink, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEventLifecycleState, type EventLifecyclePhase } from "@/lib/event-lifecycle";
import { invokeEdgeFunction } from "@/lib/functions";
import { buildPublicTicketUrl, filterOrganizerEvents } from "@/lib/organizer-dashboard";
import type { DashboardEventSummary } from "@/lib/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function DeleteEventMenuItem({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const { supabase } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleDelete() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return toast.error("Your organizer session is missing.");
    setIsDeleting(true);
    try {
      await invokeEdgeFunction({ accessToken: session.access_token, body: { event_id: eventId }, name: "delete-event" });
      setIsOpen(false);
      toast.success("Event removed from organizer and public views.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete event.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem className="text-[var(--danger)]" onSelect={(event) => { event.preventDefault(); setIsOpen(true); }}>Delete event<Trash2 className="size-4" /></DropdownMenuItem>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm deletion</AlertDialogTitle><AlertDialogDescription>Delete <strong>{eventName}</strong> from organizer and public views. Existing security and ticket records remain retained for audit. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isDeleting} onClick={(event) => { event.preventDefault(); void handleDelete(); }}>{isDeleting ? "Deleting…" : "Delete event"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  );
}

export function EventTable({ events, ticketsUrl }: { events: DashboardEventSummary[]; ticketsUrl: string }) {
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState<EventLifecyclePhase | "all">("all");
  const [listed, setListed] = useState<"all" | "listed" | "unlisted">("all");
  const filterable = useMemo(() => events.map((event) => ({ ...event, lifecycle: getEventLifecycleState(event).phase })), [events]);
  const filtered = useMemo(() => filterOrganizerEvents(filterable, { lifecycle, listed, query }), [filterable, lifecycle, listed, query]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <div className="relative"><Search className="absolute left-3 top-3 size-4 text-[var(--color-hint-of-grey)]" /><Input aria-label="Search events" className="pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search by event name or ID" value={query} /></div>
        <Select onValueChange={(value) => setLifecycle(value as EventLifecyclePhase | "all")} value={lifecycle}>
          <SelectTrigger aria-label="Filter lifecycle" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All lifecycles</SelectItem><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="active">Live</SelectItem><SelectItem value="ended">Ended</SelectItem></SelectContent>
        </Select>
        <Select onValueChange={(value) => setListed(value as "all" | "listed" | "unlisted")} value={listed}>
          <SelectTrigger aria-label="Filter listing" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All visibility</SelectItem><SelectItem value="listed">Listed</SelectItem><SelectItem value="unlisted">Unlisted</SelectItem></SelectContent>
        </Select>
      </div>
      <p className="text-xs text-[var(--color-muted-stone)] md:hidden" id="event-roster-scroll-help">
        Swipe the event roster left and right to review capacity, tickets, gate state, sync time, and actions.
      </p>
      <div className="overflow-x-auto rounded-[16px] border border-[var(--color-hint-of-grey)]/25">
        <Table
          className="min-w-[70rem]"
          containerProps={{
            "aria-describedby": "event-roster-scroll-help",
            "aria-label": "Event roster with operational columns",
            role: "region",
            tabIndex: 0,
          }}
        ><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Lifecycle</TableHead><TableHead>Capacity</TableHead><TableHead>Tickets</TableHead><TableHead>Gate</TableHead><TableHead>Last sync</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map((event) => {
            const active = event.ticketCounts.claimed + event.ticketCounts.enrolled + event.ticketCounts.checked_in;
            return <TableRow key={event.event_id}><TableCell><Link className="font-medium hover:text-[var(--color-terracotta)]" href={`/events/${event.event_id}`}>{event.name}</Link><p className="token-mono mt-1 text-[11px] text-[var(--color-muted-stone)]">{event.event_id}</p></TableCell><TableCell><div className="flex flex-wrap gap-1.5"><Badge variant={event.lifecycle === "active" ? "warmAccent" : event.lifecycle === "ended" ? "warning" : "outline"}>{event.lifecycle}</Badge><Badge variant={event.is_listed ? "success" : "secondary"}>{event.is_listed ? "Listed" : "Unlisted"}</Badge></div><p className="mt-1 text-xs text-[var(--color-muted-stone)]">{formatDate(event.starts_at)}</p></TableCell><TableCell className="tabular-nums">{active} / {event.capacity}</TableCell><TableCell><p className="text-xs"><strong>{event.ticketCounts.claimed}</strong> claimed · <strong>{event.ticketCounts.enrolled}</strong> enrolled</p><p className="mt-1 text-xs text-[var(--success)]"><strong>{event.ticketCounts.checked_in}</strong> checked in</p></TableCell><TableCell><Badge variant={event.pk_gate_event ? "success" : "warning"}>{event.pk_gate_event ? "Provisioned" : "Pending"}</Badge></TableCell><TableCell className="text-xs text-[var(--color-muted-stone)]">{event.gateLastSeenAt ? formatDate(event.gateLastSeenAt) : "Never"}</TableCell><TableCell><div className="flex justify-end gap-1"><Button asChild size="sm" variant="outline"><Link href={buildPublicTicketUrl(ticketsUrl, event.event_id)} target="_blank">Public<ExternalLink className="size-3.5" /></Link></Button><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label={`Actions for ${event.name}`} size="icon" variant="ghost"><Ellipsis className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/events/${event.event_id}`}>Open workspace</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/events/${event.event_id}/edit`}><Edit3 className="size-4" />Edit event</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/events/${event.event_id}/provisioning`}>Gate provisioning</Link></DropdownMenuItem><DropdownMenuSeparator /><DeleteEventMenuItem eventId={event.event_id} eventName={event.name} /></DropdownMenuContent></DropdownMenu></div></TableCell></TableRow>;
          })}
          {filtered.length === 0 ? <TableRow><TableCell className="py-12 text-center text-[var(--color-muted-stone)]" colSpan={7}>No events match these filters.</TableCell></TableRow> : null}
        </TableBody></Table>
      </div>
    </div>
  );
}
