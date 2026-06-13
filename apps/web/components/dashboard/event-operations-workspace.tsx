"use client";

import {
  Activity,
  ArrowLeft,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  TicketCheck,
  TicketX,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CopyButton } from "@/components/dashboard/copy-button";
import { LiveEventRefresh } from "@/components/dashboard/live-event-refresh";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getEventLifecycleState } from "@/lib/event-lifecycle";
import { invokeEdgeFunction } from "@/lib/functions";
import { filterOrganizerTickets } from "@/lib/organizer-dashboard";
import type {
  EventTicketType,
  ExportTicketsResult,
  OrganizerEventOperations,
  OrganizerTicket,
  TicketStatus,
} from "@/lib/types";

const SELECT_CLASS = "h-10 rounded-[16px] border border-[var(--color-hint-of-grey)]/40 bg-white px-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-terracotta)] focus:ring-2 focus:ring-[var(--color-warm-mist)]";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatPrice(pence: number): string {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function statusVariant(status: TicketStatus) {
  if (status === "checked_in") return "success" as const;
  if (status === "revoked") return "destructive" as const;
  if (status === "cancelled") return "secondary" as const;
  if (status === "enrolled") return "warning" as const;
  return "outline" as const;
}

function statusLabel(status: TicketStatus): string {
  return status.replace("_", " ").replace(/^./, (value) => value.toUpperCase());
}

function syncContext(lastSeenAt: string | null) {
  if (!lastSeenAt) return { label: "Critical: never synced", variant: "destructive" as const };
  const ageMinutes = (Date.now() - new Date(lastSeenAt).getTime()) / 60_000;
  if (ageMinutes <= 5) return { label: "Fresh signed receipt", variant: "success" as const };
  if (ageMinutes <= 30) return { label: "Stale signed receipt", variant: "warning" as const };
  return { label: "Critical signed receipt age", variant: "destructive" as const };
}

function TicketActionDialog({ action, ticket }: { action: "reset" | "revoke"; ticket: OrganizerTicket }) {
  const { supabase } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const isReset = action === "reset";

  async function submit() {
    if (!isReset && reason.trim().length === 0) {
      toast.error("Enter a reason for revocation.");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return toast.error("Your organizer session is missing.");
    setPending(true);
    try {
      await invokeEdgeFunction({
        accessToken: session.access_token,
        body: isReset ? { ticket_id: ticket.id } : { reason: reason.trim(), ticket_id: ticket.id },
        idempotencyKey: crypto.randomUUID(),
        name: isReset ? "reset-attendee-pass" : "revoke-ticket",
      });
      toast.success(isReset ? "Pass reset. The attendee can enroll again." : "Ticket revoked.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ticket action failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant={isReset ? "outline" : "ghost"} onClick={() => setOpen(true)}>
        {isReset ? <RefreshCcw className="size-3.5" /> : <TicketX className="size-3.5" />}
        {isReset ? "Reset pass" : "Revoke ticket"}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isReset ? "Reset attendee pass" : "Revoke ticket"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isReset
              ? `This immediately revokes ${ticket.attendee_name}'s active pass, resets generation to 0, and returns the ticket to Claimed.`
              : `This makes ${ticket.attendee_name}'s ticket unusable. Any active pass is revoked immediately.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isReset ? <div><label className="mb-2 block text-sm font-medium" htmlFor={`reason-${ticket.id}`}>Reason</label><Textarea id={`reason-${ticket.id}`} maxLength={500} onChange={(event) => setReason(event.target.value)} value={reason} /></div> : null}
        <Alert variant="destructive"><AlertTitle>This action cannot be undone</AlertTitle><AlertDescription>{isReset ? "The old pass remains revoked even after a new enrollment." : "The attendee cannot reclaim another ticket for this event."}</AlertDescription></Alert>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void submit(); }}>
            {pending ? "Applying…" : isReset ? "Reset pass" : "Revoke ticket"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TicketTypeDialog({ eventId, ticketType }: { eventId: string; ticketType?: EventTicketType }) {
  const { supabase } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(ticketType?.name ?? "");
  const [description, setDescription] = useState(ticketType?.description ?? "");
  const [price, setPrice] = useState(String((ticketType?.price_pence ?? 0) / 100));
  const [capacity, setCapacity] = useState(ticketType?.capacity === null || ticketType?.capacity === undefined ? "" : String(ticketType.capacity));
  const [active, setActive] = useState(ticketType?.is_active ?? true);

  async function submit() {
    const pricePence = Math.round(Number(price) * 100);
    const parsedCapacity = capacity.trim() === "" ? null : Number(capacity);
    if (!name.trim() || !Number.isFinite(pricePence) || pricePence < 0 || (parsedCapacity !== null && (!Number.isInteger(parsedCapacity) || parsedCapacity < 1))) {
      toast.error("Check the ticket name, GBP price, and optional capacity.");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return toast.error("Your organizer session is missing.");
    setPending(true);
    try {
      await invokeEdgeFunction({
        accessToken: session.access_token,
        body: {
          capacity: parsedCapacity,
          description: description.trim(),
          event_id: eventId,
          is_active: active,
          name: name.trim(),
          price_pence: pricePence,
          sort_order: ticketType?.sort_order ?? 100,
          ticket_type_id: ticketType?.id ?? null,
        },
        name: "manage-ticket-type",
      });
      toast.success(ticketType ? "Ticket type updated." : "Ticket type added.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ticket type could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant={ticketType ? "outline" : "default"} onClick={() => setOpen(true)}>{ticketType ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}{ticketType ? "Edit" : "Add ticket type"}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{ticketType ? "Edit ticket type" : "Add ticket type"}</DialogTitle><DialogDescription>Set the GBP price and an optional type capacity. The event capacity always remains the global ceiling.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div><label className="mb-2 block text-sm font-medium" htmlFor="ticket-type-name">Name</label><Input id="ticket-type-name" maxLength={120} onChange={(event) => setName(event.target.value)} value={name} /></div>
            <div><label className="mb-2 block text-sm font-medium" htmlFor="ticket-type-description">Description</label><Textarea id="ticket-type-description" maxLength={1000} onChange={(event) => setDescription(event.target.value)} value={description} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-medium" htmlFor="ticket-type-price">Price in GBP</label><Input id="ticket-type-price" min="0" onChange={(event) => setPrice(event.target.value)} step="0.01" type="number" value={price} /></div><div><label className="mb-2 block text-sm font-medium" htmlFor="ticket-type-capacity">Optional type capacity</label><Input id="ticket-type-capacity" min="1" onChange={(event) => setCapacity(event.target.value)} placeholder="Uses event capacity" type="number" value={capacity} /></div></div>
            <label className="flex items-center gap-3 text-sm"><input checked={active} className="size-4 accent-[var(--color-terracotta)]" onChange={(event) => setActive(event.target.checked)} type="checkbox" />Active and visible</label>
            {pricePenceFromInput(price) > 0 ? <Alert><AlertTitle>Paid checkout is unavailable</AlertTitle><AlertDescription>This type is visible in the public app, but attendees cannot check out.</AlertDescription></Alert> : null}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={pending} onClick={() => void submit()}>{pending ? "Saving…" : "Save ticket type"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function pricePenceFromInput(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function EventOperationsWorkspace({ operations, publicTicketUrl, networkLabel }: { operations: OrganizerEventOperations; publicTicketUrl: string; networkLabel: string }) {
  const { supabase } = useAuth();
  const event = operations.event;
  const lifecycle = getEventLifecycleState(event);
  const sync = syncContext(operations.gate?.last_seen_at ?? null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [ticketType, setTicketType] = useState("all");
  const [exporting, setExporting] = useState(false);
  const filteredTickets = useMemo(() => filterOrganizerTickets(operations.tickets, { query, status, ticketType }), [operations.tickets, query, status, ticketType]);
  const combinedActivity = useMemo(() => [
    ...operations.organizer_activity.map((item) => ({ created_at: item.created_at, detail: `${item.resource_type}: ${item.resource_id}`, id: `organizer-${item.id}`, label: item.activity_type.replaceAll("_", " ") })),
    ...operations.activity.map((item) => ({ created_at: item.created_at, detail: item.pass_id ? `Pass ${item.pass_id}` : `Ticket ${item.ticket_id}`, id: `ticket-${item.id}`, label: item.activity_type.replaceAll("_", " ") })),
    ...operations.checkins.map((item) => ({ created_at: item.received_at, detail: `Pass ${item.pass_id}`, id: `checkin-${item.id}`, label: "gate check-in" })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)), [operations]);
  const summaryCards: Array<{ icon: LucideIcon; label: string; value: number }> = [
    { icon: Users, label: "Attendees", value: operations.tickets.length },
    { icon: TicketCheck, label: "Accepted check-ins", value: operations.checkins.length },
    { icon: Activity, label: "Audit records", value: combinedActivity.length },
  ];

  async function exportCsv() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return toast.error("Your organizer session is missing.");
    setExporting(true);
    try {
      const result = await invokeEdgeFunction<ExportTicketsResult>({ accessToken: session.access_token, body: { event_id: event.event_id }, name: "export-organizer-tickets" });
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.row_count} tickets.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fade-section flex flex-col gap-6">
      <LiveEventRefresh eventId={event.event_id} />
      <div className="flex flex-wrap items-center gap-2"><Button asChild size="sm" variant="outline"><Link href="/dashboard"><ArrowLeft className="size-3.5" />Dashboard</Link></Button><Badge variant={lifecycle.phase === "active" ? "warmAccent" : lifecycle.phase === "ended" ? "warning" : "outline"}>{lifecycle.phase}</Badge><Badge variant={event.is_listed ? "success" : "secondary"}>{event.is_listed ? "Listed" : "Unlisted"}</Badge></div>

      <header className="grid gap-5 border-b border-[var(--color-hint-of-grey)]/25 pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-terracotta)]">Event operations</p><h1 className="display-heading mt-2 text-4xl text-[var(--color-ink)] sm:text-5xl">{event.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted-stone)]">{event.description || "No public description yet."}</p><p className="token-mono mt-2 text-xs text-[var(--color-hint-of-grey)]">{event.event_id}</p></div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/events/${event.event_id}/edit`}><Pencil className="size-4" />Edit event</Link></Button><Button asChild><Link href={publicTicketUrl} target="_blank">Public event<ExternalLink className="size-4" /></Link></Button></div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[ ["Claimed", operations.counts.claimed], ["Enrolled", operations.counts.enrolled], ["Checked in", operations.counts.checked_in], ["Cancelled", operations.counts.cancelled], ["Revoked", operations.counts.revoked] ].map(([label, value]) => <div className="rounded-[20px] border border-[var(--color-hint-of-grey)]/25 bg-white p-4" key={label}><p className="text-xs text-[var(--color-muted-stone)]">{label}</p><p className="mt-2 text-3xl font-medium tabular-nums">{value}</p></div>)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="min-w-0"><CardHeader><CardTitle>Public ticket URL</CardTitle><CardDescription>{networkLabel} mode. Mode changes require restarting Metro or rebuilding native clients.</CardDescription></CardHeader><CardContent><div className="flex min-w-0 items-center gap-2 rounded-[16px] bg-[var(--color-fog)] p-3"><code className="min-w-0 flex-1 truncate text-xs">{publicTicketUrl}</code><CopyButton label="Public ticket URL copied." value={publicTicketUrl} /></div></CardContent></Card>
        <Card className="min-w-0"><CardHeader><CardTitle>Capacity</CardTitle><CardDescription>Active allocations across every ticket type.</CardDescription></CardHeader><CardContent><p className="text-3xl font-medium tabular-nums">{operations.counts.claimed + operations.counts.enrolled + operations.counts.checked_in} <span className="text-base font-normal text-[var(--color-muted-stone)]">of {event.capacity}</span></p><p className="mt-2 text-sm text-[var(--color-muted-stone)]">{event.location || "Location not set"} · {formatTimestamp(event.starts_at)}</p></CardContent></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card><CardHeader><CardTitle>Gate state</CardTitle><CardDescription>Provisioning and signed check-in receipt context.</CardDescription></CardHeader><CardContent className="space-y-3"><Badge variant={operations.gate ? "success" : "warning"}>{operations.gate ? "Provisioned" : "Not provisioned"}</Badge><p className="text-sm text-[var(--color-muted-stone)]">{operations.gate?.device_name || "No gate device name"}</p><Button asChild size="sm" variant="outline"><Link href={`/events/${event.event_id}/provisioning`}>Open provisioning</Link></Button></CardContent></Card>
        <Card><CardHeader><CardTitle>Last signed sync</CardTitle><CardDescription>Updated automatically when signed gate check-ins reach Supabase.</CardDescription></CardHeader><CardContent className="space-y-3"><Badge variant={sync.variant}>{sync.label}</Badge><p className="text-sm text-[var(--color-muted-stone)]">{formatTimestamp(operations.gate?.last_seen_at ?? null)}</p><p className="text-xs leading-5 text-[var(--color-hint-of-grey)]">No manual gate-log upload is required for dashboard check-in totals.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Revocation context</CardTitle><CardDescription>{operations.revocations.length} server revocations for this event.</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-[var(--color-muted-stone)]">Gate cache policy: fresh at 5 minutes or less, stale over 5 minutes, critical over 30 minutes or never refreshed. A disconnected gate applies only its latest cached revocations.</p></CardContent></Card>
      </section>

      <Tabs className="min-w-0" defaultValue="tickets">
        <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="tickets">Tickets</TabsTrigger><TabsTrigger value="types">Ticket types</TabsTrigger><TabsTrigger value="activity">Activity history</TabsTrigger></TabsList>
        <TabsContent className="min-w-0" value="tickets">
          <Card className="min-w-0"><CardHeader><div className="flex flex-wrap items-end justify-between gap-4"><div><CardTitle>Ticket table</CardTitle><CardDescription>Trusted attendee profiles, pass generations, and terminal states.</CardDescription></div><Button disabled={exporting} onClick={() => void exportCsv()} variant="outline"><Download className="size-4" />{exporting ? "Exporting…" : "Export CSV"}</Button></div></CardHeader><CardContent>
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_14rem]"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-[var(--color-hint-of-grey)]" /><Input aria-label="Search attendees" className="pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" value={query} /></div><select aria-label="Filter status" className={SELECT_CLASS} onChange={(event) => setStatus(event.target.value as TicketStatus | "all")} value={status}><option value="all">All statuses</option>{["claimed", "enrolled", "checked_in", "cancelled", "revoked"].map((value) => <option key={value} value={value}>{statusLabel(value as TicketStatus)}</option>)}</select><select aria-label="Filter ticket type" className={SELECT_CLASS} onChange={(event) => setTicketType(event.target.value)} value={ticketType}><option value="all">All ticket types</option>{operations.ticket_types.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}</select></div>
            <div className="overflow-x-auto rounded-[16px] border border-[var(--color-hint-of-grey)]/25"><Table><TableHeader><TableRow><TableHead>Attendee</TableHead><TableHead>Ticket</TableHead><TableHead>Status</TableHead><TableHead>Generation</TableHead><TableHead>Pass</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredTickets.map((ticket) => <TableRow key={ticket.id}><TableCell><p className="font-medium">{ticket.attendee_name}</p><p className="text-xs text-[var(--color-muted-stone)]">{ticket.attendee_email}</p></TableCell><TableCell><p>{ticket.ticket_type_name}</p><p className="text-xs text-[var(--color-muted-stone)]">{formatPrice(ticket.ticket_type_price_pence)}</p></TableCell><TableCell><Badge variant={statusVariant(ticket.status)}>{statusLabel(ticket.status)}</Badge></TableCell><TableCell className="tabular-nums">{ticket.generation_count} of 3</TableCell><TableCell className="token-mono max-w-36 truncate text-xs">{ticket.current_pass_id ?? "—"}</TableCell><TableCell><div className="flex justify-end gap-2">{ticket.status === "enrolled" ? <TicketActionDialog action="reset" ticket={ticket} /> : null}{ticket.status === "claimed" || ticket.status === "enrolled" ? <TicketActionDialog action="revoke" ticket={ticket} /> : null}</div></TableCell></TableRow>)}{filteredTickets.length === 0 ? <TableRow><TableCell className="py-10 text-center text-[var(--color-muted-stone)]" colSpan={6}>No tickets match these filters.</TableCell></TableRow> : null}</TableBody></Table></div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent className="min-w-0" value="types">
          <Card className="min-w-0"><CardHeader><div className="flex flex-wrap items-end justify-between gap-4"><div><CardTitle>Ticket types</CardTitle><CardDescription>General Admission remains free and follows global capacity.</CardDescription></div><TicketTypeDialog eventId={event.event_id} /></div></CardHeader><CardContent><div className="overflow-x-auto rounded-[16px] border border-[var(--color-hint-of-grey)]/25"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Price</TableHead><TableHead>Capacity</TableHead><TableHead>State</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{operations.ticket_types.map((type) => <TableRow key={type.id}><TableCell><p className="font-medium">{type.name}</p><p className="text-xs text-[var(--color-muted-stone)]">{type.description || (type.is_default ? "Default event admission" : "No description")}</p>{type.price_pence > 0 ? <p className="mt-1 text-xs text-[var(--warning)]">Paid checkout unavailable</p> : null}</TableCell><TableCell>{formatPrice(type.price_pence)}</TableCell><TableCell>{type.capacity ?? "Event capacity"}</TableCell><TableCell><Badge variant={type.is_active ? "success" : "secondary"}>{type.is_active ? "Active" : "Inactive"}</Badge></TableCell><TableCell className="text-right">{type.is_default ? <Badge variant="outline">Managed by event</Badge> : <TicketTypeDialog eventId={event.event_id} ticketType={type} />}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </TabsContent>
        <TabsContent className="min-w-0" value="activity">
          <Card className="min-w-0"><CardHeader><CardTitle>Activity history</CardTitle><CardDescription>Organizer changes, ticket transitions, and accepted signed check-ins.</CardDescription></CardHeader><CardContent><div className="space-y-0">{combinedActivity.map((item, index) => <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3" key={item.id}><div className="flex flex-col items-center"><span className="mt-1.5 size-2 rounded-full bg-[var(--color-terracotta)]" />{index < combinedActivity.length - 1 ? <span className="h-full w-px bg-[var(--color-hint-of-grey)]/30" /> : null}</div><div className="pb-5"><p className="text-sm font-medium capitalize">{item.label}</p><p className="mt-1 text-xs text-[var(--color-muted-stone)]">{item.detail}</p><p className="mt-1 text-xs text-[var(--color-hint-of-grey)]">{formatTimestamp(item.created_at)}</p></div></div>)}{combinedActivity.length === 0 ? <p className="py-10 text-center text-sm text-[var(--color-muted-stone)]">No activity recorded yet.</p> : null}</div></CardContent></Card>
        </TabsContent>
      </Tabs>

      <section className="grid gap-3 sm:grid-cols-3">{summaryCards.map(({ icon: Icon, label, value }) => <div className="flex items-center gap-3 rounded-[16px] bg-[var(--color-fog)] p-4" key={label}><Icon className="size-4 text-[var(--color-terracotta)]" /><div><p className="text-xs text-[var(--color-muted-stone)]">{label}</p><p className="font-medium tabular-nums">{value}</p></div></div>)}</section>
    </div>
  );
}
