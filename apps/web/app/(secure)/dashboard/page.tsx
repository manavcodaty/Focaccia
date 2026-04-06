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
    <div className="fade-section flex flex-col gap-8">
      <section className="flex flex-col gap-6 rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--card)]/76 p-6 shadow-[0_24px_60px_-42px_rgba(10,16,36,0.45)] md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Badge variant="outline">Organizer workspace</Badge>
          <Button asChild>
            <Link href="/events/new">
              <CalendarPlus data-icon="inline-start" />
              Create event
            </Link>
          </Button>
        </div>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)] md:text-5xl">
            Welcome back, {organizer}
          </h1>
          <p className="mt-3 text-base leading-7 text-[color:var(--muted-foreground)]">
            Monitor event readiness, enforce pass revocations, and keep provisioning context clear before doors open.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metricCards.map(({ description, icon: Icon, key, label }) => (
          <Card key={key}>
            <CardHeader className="pb-3">
              <CardDescription>{label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-4xl font-semibold tracking-tight text-[color:var(--foreground)]">
                    {metrics[key]}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{description}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/55 text-[color:var(--primary)]">
                  <Icon />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        {events.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Event roster</CardTitle>
                  <CardDescription>
                    Keep provisioning status, revocation count, and gate logs visible in one operational surface.
                  </CardDescription>
                </div>
                <Badge variant="outline">{events.length} tracked</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <EventTable events={events} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <Empty className="border-[color:var(--border)] bg-[color:var(--muted)]/28 p-8">
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
                    <ArrowRight data-icon="inline-end" />
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
