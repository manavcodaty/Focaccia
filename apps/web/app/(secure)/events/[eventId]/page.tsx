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
import { getEventLifecycleState } from "@/lib/event-lifecycle";

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
  const lifecycle = getEventLifecycleState(event);

  return (
    <div className="fade-section flex flex-col gap-5">
      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Link>
        </Button>
        <Badge variant={event.pk_gate_event ? "success" : "warning"}>
          {event.pk_gate_event ? "Gate provisioned" : "Gate not provisioned"}
        </Badge>
        <Badge variant={lifecycle.phase === "ended" ? "warning" : lifecycle.phase === "active" ? "primary" : "outline"}>
          {lifecycle.phase === "ended" ? "Event ended" : lifecycle.phase === "active" ? "Event live" : "Event upcoming"}
        </Badge>
      </div>

      {/* Event header */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">Event overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[color:var(--foreground)] md:text-3xl">
            {event.name}
          </h1>
          <p className="mt-1 token-mono text-xs text-[color:var(--muted-foreground)]">
            {event.event_id}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Starts", value: formatTimestamp(event.starts_at) },
              { label: "Ends", value: formatTimestamp(event.ends_at) },
              { label: "Created", value: formatTimestamp(event.created_at) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-3">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{item.label}</p>
                <p className="mt-1 text-sm text-[color:var(--foreground)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-[color:var(--primary)]/15 bg-[color:var(--accent)]/30 p-5">
          <div className="text-xs font-medium text-[color:var(--muted-foreground)]">Join code</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="token-mono text-3xl font-medium tracking-[0.2em] text-[color:var(--foreground)]">{event.join_code}</p>
            <CopyButton label="Join code copied." value={event.join_code} />
          </div>
          <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-[color:var(--muted-foreground)]">
            {lifecycle.phase === "ended"
              ? "This event window has closed. The join code is kept for audit reference and no longer admits new attendees."
              : "Attendees use this code in the enrollment app to fetch the public event bundle."}
          </p>
        </div>
      </section>

      {/* Tabs */}
      <EventRouteTabs eventId={event.event_id} />

      {/* Gate readiness + Crypto values */}
      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {event.pk_gate_event ? <ShieldCheck className="size-4 text-[color:var(--success)]" /> : <ShieldAlert className="size-4 text-[color:var(--warning)]" />}
              Gate readiness
            </CardTitle>
            <CardDescription>
              A single gate device is allowed per event. Binding is permanent once completed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-3.5">
              <p className="text-[0.8125rem] leading-relaxed text-[color:var(--foreground)]">
                {lifecycle.phase === "ended"
                  ? "This event has ended. No new gate devices or attendee enrollments can be added."
                  : event.pk_gate_event
                    ? "This event is already bound to a gate device."
                    : "No gate has claimed this event yet."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href={`/events/${event.event_id}/provisioning`}>
                  Open provisioning
                  <ArrowRight className="size-3.5" />
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

      {/* Revocations + Logs preview */}
      <section className="grid gap-5 xl:grid-cols-2">
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
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Pass ID</TableHead>
                      <TableHead>Revoked At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revocations.slice(0, 5).map((revocation) => (
                      <TableRow key={`${revocation.event_id}-${revocation.pass_id}`}>
                        <TableCell className="token-mono text-xs">{revocation.pass_id}</TableCell>
                        <TableCell className="text-[0.8125rem] text-[color:var(--muted-foreground)]">
                          {formatTimestamp(revocation.revoked_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Empty>
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
