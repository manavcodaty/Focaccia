import Link from "next/link";
import { ArrowRight, CalendarPlus, KeySquare, ShieldCheck, TicketSlash } from "lucide-react";

import { EventTable } from "@/components/dashboard/event-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardData } from "@/lib/data";

const metricCards = [
  {
    key: "totalEvents",
    label: "Events",
    icon: KeySquare,
  },
  {
    key: "provisionedEvents",
    label: "Gate ready",
    icon: ShieldCheck,
  },
  {
    key: "totalRevocations",
    label: "Revocations",
    icon: TicketSlash,
  },
] as const;

export default async function DashboardPage() {
  const { events, metrics, user } = await getDashboardData();

  return (
    <div className="space-y-8">
      <section className="fade-section flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted-foreground)]">
            Dashboard
          </div>
          <div className="space-y-3">
            <h1 className="poster-title text-5xl leading-none text-[color:var(--foreground)]">
              Event inventory for {user.email?.split("@")[0] ?? "organizer"}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[color:var(--muted-foreground)]">
              Create event-scoped keys, track which event still needs its single gate device, and keep join codes visible without exposing any biometric material.
            </p>
          </div>
        </div>
        <Button asChild className="self-start lg:self-auto" size="lg">
          <Link href="/events/new">
            Create Event
            <CalendarPlus className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="fade-section fade-delay-1 grid gap-4 lg:grid-cols-3">
        {metricCards.map(({ icon: Icon, key, label }) => (
          <Card key={key} className="overflow-hidden">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.26em] text-[color:var(--muted-foreground)]">
                  {label}
                </div>
                <div className="mt-3 font-[family:var(--font-display)] text-4xl text-[color:var(--foreground)]">
                  {metrics[key]}
                </div>
              </div>
              <div className="flex size-12 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
                <Icon className="size-5 text-[color:var(--primary)]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="fade-section fade-delay-2">
        {events.length > 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Event roster</h2>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    Provisioning state and revocation pressure stay visible at a glance.
                  </p>
                </div>
                <Badge variant="outline">{events.length} tracked</Badge>
              </div>
              <div className="p-2 sm:p-4">
                <EventTable events={events} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-start gap-5 p-8">
              <div className="flex size-14 items-center justify-center rounded-[1.6rem] border border-[color:var(--border)] bg-[color:var(--accent)]">
                <ShieldCheck className="size-6 text-[color:var(--primary)]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">No events yet</h2>
                <p className="max-w-lg text-sm leading-7 text-[color:var(--muted-foreground)]">
                  Start by creating the event window. The server will mint the join code, event salt, and signing keys so attendee enrollment can begin immediately.
                </p>
              </div>
              <Button asChild>
                <Link href="/events/new">
                  Create the first event
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
