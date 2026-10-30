import { CalendarPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EventsDataTable } from "@/components/dashboard/events-data-table";
import { LiveDashboardRefresh } from "@/components/dashboard/live-dashboard-refresh";
import { PageHeader } from "@/components/page-header";
import { SectionCards, type SectionCardItem } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/data";
import { getPublicEnv } from "@/lib/env";
import { getEventLifecycleState } from "@/lib/event-lifecycle";

export const metadata: Metadata = { title: "Overview" };

const number = new Intl.NumberFormat("en-GB");

export default async function DashboardPage() {
  const { events } = await getDashboardData();
  const env = getPublicEnv();

  const open = events.filter((event) => getEventLifecycleState(event).phase !== "ended");
  const totals = events.reduce(
    (sum, event) => ({
      checkedIn: sum.checkedIn + event.ticketCounts.checked_in,
      issued: sum.issued + event.ticketCounts.claimed + event.ticketCounts.enrolled + event.ticketCounts.checked_in,
    }),
    { checkedIn: 0, issued: 0 },
  );
  const gatesReady = open.filter((event) => event.pk_gate_event).length;

  const cards: SectionCardItem[] = [
    { label: "Events", value: number.format(events.length) },
    { label: "Tickets", value: number.format(totals.issued) },
    { label: "Checked in", value: number.format(totals.checkedIn) },
    { label: "Gates", suffix: `/ ${open.length}`, value: number.format(gatesReady) },
  ];

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <LiveDashboardRefresh />
      <PageHeader
        actions={<Button asChild><Link href="/events/new"><CalendarPlusIcon data-icon="inline-start" />Create event</Link></Button>}
        title="Overview"
      />
      <SectionCards items={cards} label="Portfolio summary" />
      <EventsDataTable events={events} ticketsUrl={env.ticketsUrl} />
    </div>
  );
}
