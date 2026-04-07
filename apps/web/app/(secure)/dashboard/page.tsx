import Link from "next/link";
import { ArrowRight, CalendarPlus, FolderClock, ShieldCheck, TicketSlash } from "lucide-react";

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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getDashboardData } from "@/lib/data";

const metricCards = [
  {
    description: "Total tracked inventory",
    icon: FolderClock,
    key: "totalEvents",
    label: "Events",
  },
  {
    description: "Bound to a gate device",
    icon: ShieldCheck,
    key: "provisionedEvents",
    label: "Provisioned",
  },
  {
    description: "Passes currently denied",
    icon: TicketSlash,
    key: "totalRevocations",
    label: "Revocations",
  },
] as const;

export default async function DashboardPage() {
  const { events, metrics, user } = await getDashboardData();
  const organizer = user.email?.split("@")[0] ?? "organizer";

  return (
    <div className="fade-section flex flex-col gap-6">
      {/* Hero section */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              Organizer workspace
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[color:var(--foreground)] md:text-3xl">
              Welcome back, {organizer}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-[color:var(--muted-foreground)]">
              Monitor event readiness, enforce pass revocations, and keep provisioning context clear before doors open.
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
        {metricCards.map(({ description, icon: Icon, key, label }) => (
          <Card key={key}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                    {metrics[key]}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{description}</p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--accent)]/50">
                  <Icon className="size-4 text-[color:var(--primary)]" />
                </div>
              </div>
            </CardContent>
          </Card>
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
                    Provisioning status, revocation count, and gate logs in one operational surface.
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
          <Card>
            <CardContent className="p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShieldCheck />
                  </EmptyMedia>
                  <EmptyTitle>No events yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first event to issue join code, event salt, and signing key bundle.
                  </EmptyDescription>
                </EmptyHeader>
                <Button asChild>
                  <Link href="/events/new">
                    Create first event
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </Empty>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
