import Link from "next/link";
import { ArrowRight, CalendarPlus, ShieldCheck, TicketSlash } from "lucide-react";

import { EventTable } from "@/components/dashboard/event-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage() {
  const { events, metrics, user } = await getDashboardData();
  const organizer = user.email?.split("@")[0] ?? "organizer";

  return (
    <div className="fade-section flex flex-col gap-8">
      {/* Hero section */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--color-terracotta)]">
              Organizer workspace
            </p>
            <h1 className="mt-2 text-[26px] font-medium tracking-[-0.009em] text-[var(--color-ink)]">
              Welcome back, {organizer}
            </h1>
            <p className="mt-1.5 max-w-xl text-[14px] leading-[1.43] text-[var(--color-muted-stone)]">
              Monitor event readiness, enforce pass revocations, and keep
              provisioning clear before doors open.
            </p>
          </div>
          <Button asChild>
            <Link href="/events/new">
              <CalendarPlus className="size-4" />
              Create event
            </Link>
          </Button>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: CalendarPlus,
            label: "Events",
            value: metrics.totalEvents,
            description: "Total tracked inventory",
          },
          {
            icon: ShieldCheck,
            label: "Provisioned",
            value: metrics.provisionedEvents,
            description: "Bound to a gate device",
          },
          {
            icon: TicketSlash,
            label: "Revocations",
            value: metrics.totalRevocations,
            description: "Passes currently denied",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="hover-lift glass-panel relative overflow-hidden rounded-[24px] p-5 transition-premium group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-fog)]/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-medium text-[var(--color-muted-stone)]">
                  {metric.label}
                </p>
                <p className="mt-2 text-[32px] font-medium tracking-tight text-[var(--color-ink)]">
                  {metric.value}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-hint-of-grey)]">
                  {metric.description}
                </p>
              </div>
              <div className="flex size-8 items-center justify-center rounded-[12px] bg-[var(--color-warm-mist)]">
                <metric.icon className="size-4 text-[var(--color-terracotta)]" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Event roster */}
      <section>
        {events.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Event roster</CardTitle>
                  <CardDescription>
                    Provisioning status, revocations, and gate logs.
                  </CardDescription>
                </div>
                <Badge variant="outline">{events.length} tracked</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <EventTable events={events} />
            </CardContent>
          </Card>
        ) : (
          <div className="hover-lift glass-panel flex flex-col items-center gap-4 rounded-[24px] px-8 py-16 text-center transition-premium">
            <div className="flex size-12 items-center justify-center rounded-[16px] bg-[var(--color-warm-mist)]">
              <ShieldCheck className="size-5 text-[var(--color-terracotta)]" />
            </div>
            <h3 className="text-[17px] font-medium text-[var(--color-ink)]">
              No events yet
            </h3>
            <p className="max-w-sm text-[14px] text-[var(--color-muted-stone)]">
              Create your first event to generate a join code, event salt, and
              signing key bundle.
            </p>
            <Button asChild>
              <Link href="/events/new">
                Create first event
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
