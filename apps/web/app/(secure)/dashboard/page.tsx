import Link from "next/link";
import { CalendarPlus, ShieldCheck, TicketCheck, Users } from "lucide-react";

import { EventTable } from "@/components/dashboard/event-table";
import { LiveDashboardRefresh } from "@/components/dashboard/live-dashboard-refresh";
import { Button } from "@/components/ui/button";
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

      <section
        aria-label="Portfolio summary"
        className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--color-hint-of-grey)]/25 py-5 lg:grid-cols-4 lg:gap-y-0"
      >
        {metricRows.map((metric) => (
          <div className="min-w-0 lg:border-l lg:border-[var(--color-hint-of-grey)]/25 lg:pl-6 lg:first:border-l-0 lg:first:pl-0" key={metric.label}>
            <div className="flex items-center gap-2 text-[var(--color-muted-stone)]">
              <metric.icon aria-hidden="true" className="size-4 text-[var(--color-terracotta)]" />
              <p className="text-xs font-medium uppercase tracking-[0.1em]">{metric.label}</p>
            </div>
            <p className="mt-2 text-3xl font-medium tabular-nums text-[var(--color-ink)]">{metric.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="event-roster-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-ink)]" id="event-roster-heading">Event roster</h2>
            <p className="mt-1 text-sm text-[var(--color-muted-stone)]">Lifecycle, listing, ticket capacity, gate state, and signed check-in receipts.</p>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-muted-stone)]">
            {events.length} {events.length === 1 ? "event" : "events"} in view
          </p>
        </div>
        {events.length > 0 ? (
          <EventTable events={events} ticketsUrl={env.ticketsUrl} />
        ) : (
          <div className="rounded-[20px] border border-dashed border-[var(--color-hint-of-grey)]/45 bg-[var(--color-fog)] px-6 py-14 text-center">
            <p className="font-medium">No events yet</p>
            <p className="mt-2 text-sm text-[var(--color-muted-stone)]">Create an event to add General Admission and prepare a gate.</p>
            <Button asChild className="mt-5"><Link href="/events/new">Create first event</Link></Button>
          </div>
        )}
      </section>
    </div>
  );
}
