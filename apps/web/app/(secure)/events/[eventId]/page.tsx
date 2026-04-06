import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, ShieldAlert, ShieldCheck } from "lucide-react";

import { CopyButton } from "@/components/dashboard/copy-button";
import { EventRouteTabs } from "@/components/dashboard/event-route-tabs";
import { GateLogsPanel } from "@/components/dashboard/gate-logs-panel";
import { PublicValue } from "@/components/dashboard/public-value";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEventDetail } from "@/lib/data";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { event, logs, revocations } = await getEventDetail(eventId);

  return (
    <div className="fade-section flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">
            <ArrowLeft data-icon="inline-start" />
            Dashboard
          </Link>
        </Button>
        <Badge variant={event.pk_gate_event ? "success" : "warning"}>
          {event.pk_gate_event ? "Gate provisioned" : "Gate not provisioned"}
        </Badge>
      </div>

      <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--card)]/88 p-6 shadow-[0_24px_60px_-42px_rgba(10,16,36,0.48)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Event overview</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--foreground)] md:text-5xl">
              {event.name}
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              {event.event_id}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/45 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">Starts</p>
                <p className="mt-1 text-sm text-[color:var(--foreground)]">{formatTimestamp(event.starts_at)}</p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/45 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">Ends</p>
                <p className="mt-1 text-sm text-[color:var(--foreground)]">{formatTimestamp(event.ends_at)}</p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/45 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">Created</p>
                <p className="mt-1 text-sm text-[color:var(--foreground)]">{formatTimestamp(event.created_at)}</p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)]/48 p-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">Join code</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="font-mono text-4xl tracking-[0.24em] text-[color:var(--foreground)]">{event.join_code}</p>
              <CopyButton label="Join code copied." value={event.join_code} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
              Attendees use this code in the enrollment app to fetch the public event bundle.
            </p>
          </div>
        </div>
      </section>

      <EventRouteTabs eventId={event.event_id} />

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {event.pk_gate_event ? <ShieldCheck /> : <ShieldAlert />}
              Gate readiness
            </CardTitle>
            <CardDescription>
              A single gate device is allowed per event. Binding is permanent once completed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 p-4">
              <p className="text-sm leading-6 text-[color:var(--foreground)]">
                {event.pk_gate_event
                  ? "This event is already bound to a gate device."
                  : "No gate has claimed this event yet."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href={`/events/${event.event_id}/provisioning`}>
                  Open provisioning
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/events/${event.event_id}/revocations`}>Manage revocations</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/events/${event.event_id}/logs`}>View gate logs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public cryptographic values</CardTitle>
            <CardDescription>
              Safe to share with enrollment and gate apps. These values contain no biometric data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <PublicValue label="PK_SIGN_EVENT" value={event.pk_sign_event} />
            <PublicValue label="EVENT_SALT" value={event.event_salt} />
            {event.pk_gate_event ? (
              <PublicValue label="PK_GATE_EVENT" subtle value={event.pk_gate_event} />
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Revocation preview</CardTitle>
                <CardDescription>
                  Quick view of the latest denied pass IDs for this event.
                </CardDescription>
              </div>
              <Badge variant="outline">{revocations.length} total</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {revocations.length > 0 ? (
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pass ID</TableHead>
                      <TableHead>Revoked At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revocations.slice(0, 5).map((revocation) => (
                      <TableRow key={`${revocation.event_id}-${revocation.pass_id}`}>
                        <TableCell className="font-mono text-xs">{revocation.pass_id}</TableCell>
                        <TableCell className="text-sm text-[color:var(--muted-foreground)]">
                          {formatTimestamp(revocation.revoked_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Empty className="border-[color:var(--border)] bg-[color:var(--muted)]/30 p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Clock3 />
                  </EmptyMedia>
                  <EmptyTitle>No revocations yet</EmptyTitle>
                  <EmptyDescription>
                    This event currently has no denied pass IDs.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <GateLogsPanel compact logs={logs} />
      </section>
    </div>
  );
}
