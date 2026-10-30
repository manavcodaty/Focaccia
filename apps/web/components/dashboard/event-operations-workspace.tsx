"use client";

import {
  ActivityIcon,
  CircleCheckIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  QrCodeIcon,
  RefreshCcwIcon,
  SearchIcon,
  TicketIcon,
  TicketXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { CopyInputButton } from "@/components/dashboard/copy-button";
import { EventHeader } from "@/components/dashboard/event-header";
import { LiveEventRefresh } from "@/components/dashboard/live-event-refresh";
import { useAuth } from "@/components/providers/auth-provider";
import { SectionCards, type SectionCardItem } from "@/components/section-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatTimestamp } from "@/lib/format-timestamp";
import { invokeEdgeFunction } from "@/lib/functions";
import { filterOrganizerTickets } from "@/lib/organizer-dashboard";
import type {
  EventTicketType,
  ExportTicketsResult,
  OrganizerEventOperations,
  OrganizerTicket,
  TicketStatus,
} from "@/lib/types";

const statuses: TicketStatus[] = ["claimed", "enrolled", "checked_in", "cancelled", "revoked"];

function formatPrice(pence: number): string {
  return pence === 0 ? "Free" : new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function statusLabel(status: TicketStatus): string {
  return status.replace("_", " ").replace(/^./, (value) => value.toUpperCase());
}

function TicketStatusText({ status }: { status: TicketStatus }) {
  return (
    <span className={status === "revoked" ? "text-sm text-destructive" : "text-sm"}>
      {statusLabel(status)}
    </span>
  );
}

/** crypto.randomUUID needs a secure context; the LAN demo runs on plain HTTP. */
function createIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}


function TicketActionDialog({ action, onOpenChange, open, ticket }: { action: "reset" | "revoke"; onOpenChange: (open: boolean) => void; open: boolean; ticket: OrganizerTicket }) {
  const { supabase } = useAuth();
  const router = useRouter();
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
        idempotencyKey: createIdempotencyKey(),
        name: isReset ? "reset-attendee-pass" : "revoke-ticket",
      });
      toast.success(isReset ? "Pass reset." : "Ticket revoked.");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ticket action failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isReset ? "Reset pass" : "Revoke ticket"}</AlertDialogTitle>
          <AlertDialogDescription>
            {ticket.attendee_name} · This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isReset ? (
          <Field>
            <FieldLabel htmlFor={`reason-${ticket.id}`}>Reason</FieldLabel>
            <Textarea id={`reason-${ticket.id}`} maxLength={500} onChange={(event) => setReason(event.target.value)} value={reason} />
          </Field>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void submit(); }} variant="destructive">
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "Applying…" : isReset ? "Reset pass" : "Revoke ticket"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TicketRowActions({ ticket }: { ticket: OrganizerTicket }) {
  const [action, setAction] = useState<"reset" | "revoke" | null>(null);
  const canReset = ticket.status === "enrolled";
  const canRevoke = ticket.status === "claimed" || ticket.status === "enrolled";
  if (!canReset && !canRevoke) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={`Actions for ${ticket.attendee_name}`} className="text-muted-foreground data-[state=open]:bg-muted" size="icon-sm" variant="ghost">
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            {canReset ? <DropdownMenuItem onSelect={() => setAction("reset")}><RefreshCcwIcon />Reset pass</DropdownMenuItem> : null}
            {canRevoke ? <DropdownMenuItem onSelect={() => setAction("revoke")} variant="destructive"><TicketXIcon />Revoke ticket</DropdownMenuItem> : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {action ? <TicketActionDialog action={action} onOpenChange={(open) => { if (!open) setAction(null); }} open ticket={ticket} /> : null}
    </>
  );
}

function pricePenceFromInput(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
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
  const idPrefix = ticketType ? `ticket-type-${ticketType.id}` : "ticket-type-new";

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
      <Button onClick={() => setOpen(true)} size={ticketType ? "sm" : "default"} variant={ticketType ? "ghost" : "outline"}>
        {ticketType ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
        {ticketType ? "Edit" : "Add ticket type"}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ticketType ? `Edit ${ticketType.name}` : "Add ticket type"}</DialogTitle>
            <DialogDescription className="sr-only">Name, price, capacity and visibility.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
              <Input id={`${idPrefix}-name`} maxLength={120} onChange={(event) => setName(event.target.value)} value={name} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-description`}>Description</FieldLabel>
              <Textarea id={`${idPrefix}-description`} maxLength={1000} onChange={(event) => setDescription(event.target.value)} value={description} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-price`}>Price</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>£</InputGroupAddon>
                  <InputGroupInput id={`${idPrefix}-price`} inputMode="decimal" min={0} onChange={(event) => setPrice(event.target.value)} step="0.01" type="number" value={price} />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-capacity`}>Capacity</FieldLabel>
                <Input id={`${idPrefix}-capacity`} min={1} onChange={(event) => setCapacity(event.target.value)} type="number" value={capacity} />
              </Field>
            </div>
            <Field orientation="horizontal">
              <FieldLabel htmlFor={`${idPrefix}-active`}>Active</FieldLabel>
              <Switch checked={active} id={`${idPrefix}-active`} onCheckedChange={setActive} />
            </Field>
            {pricePenceFromInput(price) > 0 ? (
              <Alert>
                <TriangleAlertIcon />
                <AlertTitle>Paid checkout is unavailable</AlertTitle>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="outline">Cancel</Button>
            <Button disabled={pending} onClick={() => void submit()}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Saving…" : "Save ticket type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Allocation as plain figures, laid out like the neighbouring public link card's details. */
function AllocationCard({ capacity, counts, ticketTypes, tickets }: { capacity: number; counts: OrganizerEventOperations["counts"]; ticketTypes: EventTicketType[]; tickets: OrganizerTicket[] }) {
  const issuedByType = tickets.reduce<Record<string, number>>((map, ticket) => {
    if (ticket.status === "claimed" || ticket.status === "enrolled" || ticket.status === "checked_in") map[ticket.ticket_type_id] = (map[ticket.ticket_type_id] ?? 0) + 1;
    return map;
  }, {});
  const allocated = counts.claimed + counts.enrolled + counts.checked_in;
  const totals: Array<[string, number]> = [
    ["Remaining", Math.max(0, capacity - allocated)],
    ["Cancelled", counts.cancelled],
    ["Revoked", counts.revoked],
  ];

  return (
    <Card className="@container/card @5xl/main:col-span-2">
      <CardHeader>
        <CardTitle>Allocation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl aria-label="Tickets by type" className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
          {ticketTypes.map((type) => (
            <Fragment key={type.id}>
              <dt className="truncate text-muted-foreground">{type.name}</dt>
              <dd className="text-right tabular-nums">{issuedByType[type.id] ?? 0}<span className="text-muted-foreground"> / {type.capacity ?? capacity}</span></dd>
            </Fragment>
          ))}
        </dl>
        <Separator />
        <dl aria-label="Ticket totals" className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
          {totals.map(([term, value]) => (
            <Fragment key={term}>
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="text-right tabular-nums">{value}</dd>
            </Fragment>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function ShareCard({ eventId, gateDevice, networkLabel, publicTicketUrl, revocations }: { eventId: string; gateDevice: OrganizerEventOperations["gate"]; networkLabel: string; publicTicketUrl: string; revocations: number }) {
  const base = `/events/${encodeURIComponent(eventId)}`;
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Public link</CardTitle>
        <CardDescription className="sr-only">{networkLabel}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InputGroup>
          <InputGroupInput aria-label="Public ticket URL" className="font-mono text-xs" readOnly value={publicTicketUrl} />
          <InputGroupAddon align="inline-end">
            <CopyInputButton label="Public ticket URL copied." name="public ticket URL" value={publicTicketUrl} />
            <InputGroupButton asChild aria-label="Open public ticket page" size="icon-xs">
              <a href={publicTicketUrl} rel="noreferrer" target="_blank"><ExternalLinkIcon /></a>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Separator />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Gate</dt>
          <dd className="truncate text-right">{gateDevice ? gateDevice.device_name || "Unnamed device" : "—"}</dd>
          <dt className="text-muted-foreground">Last sync</dt>
          <dd className="text-right tabular-nums">{formatTimestamp(gateDevice?.last_seen_at ?? null)}</dd>
          <dt className="text-muted-foreground">Revocations</dt>
          <dd className="text-right tabular-nums"><Link className="underline-offset-4 hover:underline" href={`${base}/revocations`}>{revocations}</Link></dd>
        </dl>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full" variant="outline"><Link href={`${base}/provisioning`}><QrCodeIcon data-icon="inline-start" />Gate setup</Link></Button>
      </CardFooter>
    </Card>
  );
}

export function EventOperationsWorkspace({ operations, publicTicketUrl, networkLabel }: { operations: OrganizerEventOperations; publicTicketUrl: string; networkLabel: string }) {
  const { supabase } = useAuth();
  const event = operations.event;
  const counts = operations.counts;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [ticketType, setTicketType] = useState("all");
  const [exporting, setExporting] = useState(false);
  const filteredTickets = useMemo(() => filterOrganizerTickets(operations.tickets, { query, status, ticketType }), [operations.tickets, query, status, ticketType]);
  const combinedActivity = useMemo(() => [
    ...operations.organizer_activity.map((item) => ({ created_at: item.created_at, detail: `${item.resource_type.replaceAll("_", " ")} · ${item.resource_id}`, id: `organizer-${item.id}`, kind: "organizer" as const, label: item.activity_type.replaceAll("_", " ") })),
    ...operations.activity.map((item) => ({ created_at: item.created_at, detail: item.pass_id ? `Pass ${item.pass_id}` : `Ticket ${item.ticket_id}`, id: `ticket-${item.id}`, kind: "ticket" as const, label: item.activity_type.replaceAll("_", " ") })),
    ...operations.checkins.map((item) => ({ created_at: item.received_at, detail: `Pass ${item.pass_id}`, id: `checkin-${item.id}`, kind: "checkin" as const, label: "gate check-in" })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)), [operations]);

  const allocated = counts.claimed + counts.enrolled + counts.checked_in;
  const cards: SectionCardItem[] = [
    { label: "Tickets", suffix: `/ ${event.capacity}`, value: allocated },
    { label: "Claimed", value: counts.claimed },
    { label: "Enrolled", value: counts.enrolled },
    { label: "Checked in", value: counts.checked_in },
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
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <LiveEventRefresh eventId={event.event_id} />
      <EventHeader
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/events/${encodeURIComponent(event.event_id)}/edit`}><PencilIcon data-icon="inline-start" />Edit event</Link></Button>
            <Button asChild variant="outline"><a href={publicTicketUrl} rel="noreferrer" target="_blank">Public page<ExternalLinkIcon data-icon="inline-end" /></a></Button>
          </>
        }
        counts={{ "/revocations": operations.revocations.length }}
        event={event}
      />

      <SectionCards items={cards} label="Ticket state summary" />

      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-3">
        <AllocationCard capacity={event.capacity} counts={counts} ticketTypes={operations.ticket_types} tickets={operations.tickets} />
        <ShareCard eventId={event.event_id} gateDevice={operations.gate} networkLabel={networkLabel} publicTicketUrl={publicTicketUrl} revocations={operations.revocations.length} />
      </div>

      <Tabs className="min-w-0 gap-4 px-4 lg:px-6" defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">Tickets <span className="text-sm tabular-nums">{operations.tickets.length}</span></TabsTrigger>
          <TabsTrigger value="types">Ticket types</TabsTrigger>
          <TabsTrigger value="activity">Activity history</TabsTrigger>
        </TabsList>

        <TabsContent className="flex min-w-0 flex-col gap-4" value="tickets">
          <div className="flex flex-col gap-2 @3xl/main:flex-row @3xl/main:items-center">
            <InputGroup className="@3xl/main:max-w-72">
              <InputGroupAddon><SearchIcon /></InputGroupAddon>
              <InputGroupInput aria-label="Search attendees" onChange={(changeEvent) => setQuery(changeEvent.target.value)} placeholder="Search name or email" value={query} />
            </InputGroup>
            <div className="flex gap-2">
              <Select onValueChange={(value) => setStatus(value as TicketStatus | "all")} value={status}>
                <SelectTrigger aria-label="Filter status" className="flex-1 @3xl/main:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statuses.map((value) => <SelectItem key={value} value={value}>{statusLabel(value)} ({counts[value]})</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select onValueChange={setTicketType} value={ticketType}>
                <SelectTrigger aria-label="Filter ticket type" className="flex-1 @3xl/main:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All ticket types</SelectItem>
                    {operations.ticket_types.map((type) => <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button className="@3xl/main:ml-auto" disabled={exporting} onClick={() => void exportCsv()} variant="outline">
              {exporting ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table aria-label="Tickets" className="min-w-[48rem]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Attendee</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Generation</TableHead>
                  <TableHead>Pass</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{ticket.attendee_name}</span>
                        <span className="text-xs text-muted-foreground">{ticket.attendee_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticket.ticket_type_name}
                    </TableCell>
                    <TableCell><TicketStatusText status={ticket.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{ticket.generation_count}<span className="text-muted-foreground"> / 3</span></TableCell>
                    <TableCell className="max-w-36 truncate font-mono text-xs text-muted-foreground">{ticket.current_pass_id ?? "—"}</TableCell>
                    <TableCell><div className="flex justify-end"><TicketRowActions ticket={ticket} /></div></TableCell>
                  </TableRow>
                ))}
                {filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                      {operations.tickets.length === 0 ? "No tickets" : "No results"}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent className="min-w-0" value="types">
          <Card>
            <CardHeader>
              <CardTitle>Ticket types</CardTitle>
              <CardAction><TicketTypeDialog eventId={event.event_id} /></CardAction>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <Table aria-label="Ticket types" className="min-w-[40rem]">
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.ticket_types.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{type.name}</span>
                            {type.description ? <span className="text-xs text-muted-foreground">{type.description}</span> : null}
                                                      </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatPrice(type.price_pence)}</TableCell>
                        <TableCell className="text-right tabular-nums">{type.capacity ?? <span className="text-muted-foreground">Event</span>}</TableCell>
                        <TableCell><span className="text-sm">{type.is_active ? "Active" : "Inactive"}</span></TableCell>
                        <TableCell className="text-right">{type.is_default ? null : <TicketTypeDialog eventId={event.event_id} ticketType={type} />}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="min-w-0" value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity history</CardTitle>
            </CardHeader>
            <CardContent>
              {combinedActivity.length > 0 ? (
                <ItemGroup className="max-h-[32rem] overflow-y-auto">
                  {combinedActivity.map((item, index) => (
                    <Fragment key={item.id}>
                      {index > 0 ? <ItemSeparator /> : null}
                      <Item size="sm">
                        <ItemMedia variant="icon">
                          {item.kind === "checkin" ? <CircleCheckIcon className="text-success" /> : item.kind === "ticket" ? <TicketIcon className="text-muted-foreground" /> : <ActivityIcon className="text-muted-foreground" />}
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle className="capitalize">{item.label}</ItemTitle>
                          <ItemDescription className="font-mono text-xs">{item.detail}</ItemDescription>
                        </ItemContent>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatTimestamp(item.created_at)}</span>
                      </Item>
                    </Fragment>
                  ))}
                </ItemGroup>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ActivityIcon /></EmptyMedia>
                    <EmptyTitle>No activity</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
