"use client";

import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns3Icon,
  CopyIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  PencilIcon,
  QrCodeIcon,
  SearchIcon,
  SquareArrowOutUpRightIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
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
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { getEventLifecycleState, type EventLifecyclePhase } from "@/lib/event-lifecycle";
import { formatTimestamp } from "@/lib/format-timestamp";
import { copyText } from "@/lib/copy-text";
import { invokeEdgeFunction } from "@/lib/functions";
import { buildPublicTicketUrl, filterOrganizerEvents } from "@/lib/organizer-dashboard";
import type { DashboardEventSummary } from "@/lib/types";

type EventRow = DashboardEventSummary & { allocated: number; lifecycle: EventLifecyclePhase };
type View = "all" | EventLifecyclePhase;

const features = tableFeatures({
  columnVisibilityFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowPaginationFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const columnHelper = createColumnHelper<typeof features, EventRow>();

const views: Array<{ label: string; value: View }> = [
  { label: "All events", value: "all" },
  { label: "Live", value: "active" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Ended", value: "ended" },
];

export function LifecycleText({ phase }: { phase: EventLifecyclePhase }) {
  return <span className="text-sm">{lifecycleLabel[phase]}</span>;
}

const lifecycleLabel: Record<EventLifecyclePhase, string> = { active: "Live", ended: "Ended", upcoming: "Upcoming" };

function SortHeader({ children, column, align = "left" }: { align?: "left" | "right"; children: React.ReactNode; column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void } }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <div className={align === "right" ? "flex justify-end" : undefined}>
      <Button className="-mx-2 text-muted-foreground" onClick={() => column.toggleSorting(sorted === "asc")} size="sm" variant="ghost">
        {children}
        <Icon data-icon="inline-end" />
      </Button>
    </div>
  );
}

function DeleteEventDialog({ event, onOpenChange, open }: { event: EventRow; onOpenChange: (open: boolean) => void; open: boolean }) {
  const router = useRouter();
  const { supabase } = useAuth();
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return toast.error("Your organizer session is missing.");
    setPending(true);
    try {
      await invokeEdgeFunction({ accessToken: session.access_token, body: { event_id: event.event_id }, name: "delete-event" });
      onOpenChange(false);
      toast.success(`${event.name} deleted.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Event could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {event.name}?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={(clickEvent) => { clickEvent.preventDefault(); void handleDelete(); }} variant="destructive">
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "Deleting…" : "Delete event"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RowActions({ event, ticketsUrl }: { event: EventRow; ticketsUrl: string }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const publicUrl = buildPublicTicketUrl(ticketsUrl, event.event_id);
  const base = `/events/${encodeURIComponent(event.event_id)}`;

  async function copyLink() {
    try {
      await copyText(publicUrl);
      toast.success("Public ticket link copied.");
    } catch {
      toast.error("Clipboard unavailable. Open the public page instead.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={`Actions for ${event.name}`} className="text-muted-foreground data-[state=open]:bg-muted" size="icon-sm" variant="ghost">
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild><Link href={base}><SquareArrowOutUpRightIcon />Open workspace</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={`${base}/edit`}><PencilIcon />Edit event</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={`${base}/provisioning`}><QrCodeIcon />Gate setup</Link></DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => void copyLink()}><CopyIcon />Copy public link</DropdownMenuItem>
            <DropdownMenuItem asChild><a href={publicUrl} rel="noreferrer" target="_blank"><ExternalLinkIcon />View public page</a></DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setConfirmOpen(true)} variant="destructive"><Trash2Icon />Delete event</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteEventDialog event={event} onOpenChange={setConfirmOpen} open={confirmOpen} />
    </>
  );
}

function FactList({ items, label }: { items: Array<[string, React.ReactNode]>; label: string }) {
  return (
    <section aria-label={label} className="flex flex-col gap-2.5">
      <h3 className="font-medium">{label}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
        {items.map(([term, value]) => (
          <React.Fragment key={term}>
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}

function EventDrawerBody({ event, ticketsUrl }: { event: EventRow; ticketsUrl: string }) {
  const counts = event.ticketCounts;
  const tickets: Array<[string, React.ReactNode]> = [
    ["Allocated", <>{event.allocated}<span className="text-muted-foreground"> / {event.capacity}</span></>],
    ["Claimed", counts.claimed],
    ["Enrolled", counts.enrolled],
    ["Checked in", counts.checked_in],
    ["Cancelled", counts.cancelled],
    ["Revoked", counts.revoked],
  ];
  const details: Array<[string, React.ReactNode]> = [
    ["Status", lifecycleLabel[event.lifecycle]],
    ["Starts", formatTimestamp(event.starts_at)],
    ["Ends", formatTimestamp(event.ends_at)],
    ["Location", event.location || "—"],
    ["Visibility", event.is_listed ? "Listed" : "Unlisted"],
    ["Gate", event.pk_gate_event ? "Provisioned" : "Not set up"],
    ["Last sync", event.gateLastSeenAt ? formatTimestamp(event.gateLastSeenAt) : "—"],
    ["Revocations", event.revocationCount],
  ];

  return (
    <>
      <DrawerHeader className="gap-1">
        <DrawerTitle className="text-lg">{event.name}</DrawerTitle>
        <DrawerDescription className="font-mono text-xs">{event.event_id}</DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
        <FactList items={tickets} label="Tickets" />
        <Separator />
        <FactList items={details} label="Details" />
        {event.description ? (<><Separator /><p className="leading-relaxed text-muted-foreground">{event.description}</p></>) : null}
      </div>
      <DrawerFooter>
        <Button asChild><Link href={`/events/${encodeURIComponent(event.event_id)}`}>Open workspace</Link></Button>
        <Button asChild variant="outline"><a href={buildPublicTicketUrl(ticketsUrl, event.event_id)} rel="noreferrer" target="_blank">View public page<ExternalLinkIcon data-icon="inline-end" /></a></Button>
        <DrawerClose asChild><Button variant="ghost">Close</Button></DrawerClose>
      </DrawerFooter>
    </>
  );
}

/** Clicks on the row's own controls, or bubbling up from portalled menus and dialogs, must not open the drawer. */
function isRowOpenClick(clickEvent: React.MouseEvent<HTMLTableRowElement>) {
  const target = clickEvent.target as HTMLElement;
  if (!clickEvent.currentTarget.contains(target)) return false;
  if (target.closest("a, button, input, label, select, textarea, [role='menuitem']")) return false;
  return !window.getSelection()?.toString();
}

function buildColumns(ticketsUrl: string, openEvent: (eventId: string) => void) {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      cell: ({ row }) => (
        <div className="max-w-72 min-w-0">
          <Button className="h-auto w-fit max-w-full justify-start px-0 text-left font-medium text-foreground" onClick={() => openEvent(row.original.event_id)} variant="link">
            <span className="truncate">{row.original.name}</span>
          </Button>
        </div>
      ),
      enableHiding: false,
      header: ({ column }) => <SortHeader column={column}>Event</SortHeader>,
    }),
    columnHelper.accessor("lifecycle", {
      cell: ({ row }) => <LifecycleText phase={row.original.lifecycle} />,
      enableSorting: false,
      header: "Status",
    }),
    columnHelper.accessor("starts_at", {
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatTimestamp(row.original.starts_at)}</span>,
      header: ({ column }) => <SortHeader column={column}>Starts</SortHeader>,
    }),
    columnHelper.accessor("allocated", {
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.allocated}<span className="text-muted-foreground"> / {row.original.capacity}</span>
        </div>
      ),
      header: ({ column }) => <SortHeader align="right" column={column}>Allocated</SortHeader>,
    }),
    columnHelper.accessor((row) => row.ticketCounts.checked_in, {
      cell: ({ row }) => <div className="text-right tabular-nums">{row.original.ticketCounts.checked_in}</div>,
      header: ({ column }) => <SortHeader align="right" column={column}>Checked in</SortHeader>,
      id: "checked_in",
    }),
    columnHelper.accessor("is_listed", {
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.is_listed ? "Listed" : "Unlisted"}</span>,
      enableSorting: false,
      header: "Visibility",
    }),
    columnHelper.accessor((row) => Boolean(row.pk_gate_event), {
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{row.original.pk_gate_event ? "Provisioned" : "Not set up"}</span>,
      enableSorting: false,
      header: "Gate",
      id: "gate",
    }),
    columnHelper.accessor("gateLastSeenAt", {
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground tabular-nums">{row.original.gateLastSeenAt ? formatTimestamp(row.original.gateLastSeenAt) : "—"}</span>,
      enableSorting: false,
      header: "Last sync",
    }),
    columnHelper.display({
      cell: ({ row }) => <div className="flex justify-end"><RowActions event={row.original} ticketsUrl={ticketsUrl} /></div>,
      id: "actions",
    }),
  ]);
}

const columnLabels: Record<string, string> = {
  allocated: "Allocated",
  checked_in: "Checked in",
  gate: "Gate",
  gateLastSeenAt: "Last sync",
  is_listed: "Visibility",
  lifecycle: "Status",
  starts_at: "Starts",
};

export function EventsDataTable({ events, ticketsUrl }: { events: DashboardEventSummary[]; ticketsUrl: string }) {
  const [view, setView] = React.useState<View>("all");
  const [query, setQuery] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const openEvent = React.useCallback((eventId: string) => {
    setSelectedId(eventId);
    setDrawerOpen(true);
  }, []);
  const rows = React.useMemo<EventRow[]>(() => events.map((event) => ({
    ...event,
    allocated: event.ticketCounts.claimed + event.ticketCounts.enrolled + event.ticketCounts.checked_in,
    lifecycle: getEventLifecycleState(event).phase,
  })), [events]);
  const counts = React.useMemo(() => ({
    active: rows.filter((row) => row.lifecycle === "active").length,
    all: rows.length,
    ended: rows.filter((row) => row.lifecycle === "ended").length,
    upcoming: rows.filter((row) => row.lifecycle === "upcoming").length,
  }), [rows]);
  const data = React.useMemo(() => filterOrganizerEvents(rows, { lifecycle: view, listed: "all", query }), [rows, view, query]);
  const columns = React.useMemo(() => buildColumns(ticketsUrl, openEvent), [ticketsUrl, openEvent]);
  // Keep the last selection mounted while the drawer animates closed; drop it if the event disappears.
  const selected = rows.find((row) => row.event_id === selectedId) ?? null;

  const table = useTable({
    columns,
    data,
    features,
    getRowId: (row) => row.event_id,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: { columnVisibility, pagination, sorting },
  });

  React.useEffect(() => { setPagination((current) => ({ ...current, pageIndex: 0 })); }, [view, query]);
  const changeView = (value: string) => setView(value as View);

  return (
    <Tabs className="w-full scroll-mt-20 flex-col justify-start gap-4" id="events" onValueChange={changeView} value={view}>
      <div className="flex flex-col gap-3 px-4 lg:px-6 @3xl/main:flex-row @3xl/main:items-center @3xl/main:justify-between">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold @4xl/main:sr-only">Events</h2>
          <Label className="sr-only" htmlFor="view-selector">View</Label>
          <Select onValueChange={changeView} value={view}>
            <SelectTrigger className="flex w-fit @4xl/main:hidden" id="view-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {views.map((item) => <SelectItem key={item.value} value={item.value}>{item.label} ({counts[item.value]})</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <TabsList className="hidden @4xl/main:flex">
            {views.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
                {item.value !== "all" && counts[item.value] > 0 ? <span className="text-sm tabular-nums">{counts[item.value]}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="flex items-center gap-2">
          <InputGroup className="w-full @3xl/main:w-64">
            <InputGroupAddon><SearchIcon /></InputGroupAddon>
            <InputGroupInput aria-label="Search events" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or ID" value={query} />
          </InputGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns3Icon data-icon="inline-start" />
                <span className="hidden lg:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuGroup>
                {table.getAllColumns().filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide()).map((column) => (
                  <DropdownMenuCheckboxItem checked={column.getIsVisible()} key={column.id} onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}>
                    {columnLabels[column.id] ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
      <TabsContent className="relative flex flex-col gap-4 px-4 lg:px-6" value={view}>
        {rows.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarPlusIcon /></EmptyMedia>
              <EmptyTitle>No events</EmptyTitle>
            </EmptyHeader>
            <EmptyContent><Button asChild><Link href="/events/new">Create event</Link></Button></EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <Table aria-label="Events" className="min-w-[60rem]">
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead className={header.column.id === "allocated" || header.column.id === "checked_in" ? "text-right" : undefined} colSpan={header.colSpan} key={header.id}>
                          {header.isPlaceholder ? null : <FlexRender header={header} />}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
                    <TableRow
                      className="cursor-pointer"
                      data-state={drawerOpen && selectedId === row.id ? "selected" : undefined}
                      key={row.id}
                      onClick={(clickEvent) => { if (isRowOpenClick(clickEvent)) openEvent(row.original.event_id); }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}><FlexRender cell={cell} /></TableCell>
                      ))}
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell className="h-24 text-center text-muted-foreground" colSpan={columns.length}>
                        No results
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-1">
              <div className="ml-auto flex w-full items-center gap-8 lg:w-fit">
                <div className="hidden items-center gap-2 lg:flex">
                  <Label className="text-sm font-medium" htmlFor="rows-per-page">Rows per page</Label>
                  <Select onValueChange={(value) => table.setPageSize(Number(value))} value={`${table.state.pagination.pageSize}`}>
                    <SelectTrigger className="w-20" id="rows-per-page"><SelectValue /></SelectTrigger>
                    <SelectContent side="top">
                      <SelectGroup>
                        {[10, 20, 30, 50].map((pageSize) => <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center text-sm font-medium tabular-nums">
                  Page {table.state.pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button className="hidden lg:flex" disabled={!table.getCanPreviousPage()} onClick={() => table.setPageIndex(0)} size="icon" variant="outline">
                    <span className="sr-only">Go to first page</span><ChevronsLeftIcon />
                  </Button>
                  <Button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} size="icon" variant="outline">
                    <span className="sr-only">Go to previous page</span><ChevronLeftIcon />
                  </Button>
                  <Button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} size="icon" variant="outline">
                    <span className="sr-only">Go to next page</span><ChevronRightIcon />
                  </Button>
                  <Button className="hidden lg:flex" disabled={!table.getCanNextPage()} onClick={() => table.setPageIndex(table.getPageCount() - 1)} size="icon" variant="outline">
                    <span className="sr-only">Go to last page</span><ChevronsRightIcon />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </TabsContent>
      <Drawer direction={isMobile ? "bottom" : "right"} onOpenChange={setDrawerOpen} open={drawerOpen && selected !== null}>
        <DrawerContent>
          {selected ? <EventDrawerBody event={selected} ticketsUrl={ticketsUrl} /> : null}
        </DrawerContent>
      </Drawer>
    </Tabs>
  );
}
