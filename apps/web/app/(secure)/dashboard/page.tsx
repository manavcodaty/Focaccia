import Link from "next/link";
import { CalendarPlus, ShieldCheck, TicketCheck, Users } from "lucide-react";

import { EventTable } from "@/components/dashboard/event-table";
import { LiveDashboardRefresh } from "@/components/dashboard/live-dashboard-refresh";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/data";
import { getPublicEnv } from "@/lib/env";

export default async function DashboardPage() {
  const { events, metrics, user } = await getDashboardData();
  const env = getPublicEnv();
  const organizer = user.email?.split("@")[0] ?? "organizer";
  const metricRows = [
    { icon: CalendarPlus, label: "Events", value: metrics.totalEvents },
    { icon: Users, label: "Tickets", value: metrics.totalTickets },
    { icon: TicketCheck, label: "Checked in", value: metrics.checkedIn },
    { icon: ShieldCheck, label: "Provisioned gates", value: metrics.provisionedEvents },
  ];

  return (
    <div className="fade-section flex flex-col gap-7">
      <LiveDashboardRefresh />
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--color-hint-of-grey)]/25 pb-6">
        <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-terracotta)]">Organizer workspace</p><h1 className="display-heading mt-2 text-4xl text-[var(--color-ink)] sm:text-5xl">Events</h1><p className="mt-2 text-sm text-[var(--color-muted-stone)]">Signed in as {organizer}. Public links currently use <strong>{env.mode}</strong> mode.</p></div>
        <Button asChild><Link href="/events/new"><CalendarPlus className="size-4" />Create event</Link></Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricRows.map((metric) => <div className="rounded-[20px] border border-[var(--color-hint-of-grey)]/25 bg-white p-4" key={metric.label}><div className="flex items-center justify-between"><p className="text-xs text-[var(--color-muted-stone)]">{metric.label}</p><metric.icon className="size-4 text-[var(--color-terracotta)]" /></div><p className="mt-2 text-3xl font-medium tabular-nums">{metric.value}</p></div>)}</section>

      <Card><CardHeader><CardTitle>Event roster</CardTitle><CardDescription>Lifecycle, listing, ticket capacity, gate state, and signed check-in receipts.</CardDescription></CardHeader><CardContent>{events.length > 0 ? <EventTable events={events} ticketsUrl={env.ticketsUrl} /> : <div className="rounded-[20px] bg-[var(--color-fog)] px-6 py-14 text-center"><p className="font-medium">No events yet</p><p className="mt-2 text-sm text-[var(--color-muted-stone)]">Create an event to add General Admission and prepare a gate.</p><Button asChild className="mt-5"><Link href="/events/new">Create first event</Link></Button></div>}</CardContent></Card>
    </div>
  );
}
