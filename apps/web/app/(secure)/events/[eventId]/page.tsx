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
    <div className="fade-section flex flex-col gap-6">
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
        <Badge
          variant={
            lifecycle.phase === "ended"
              ? "warning"
              : lifecycle.phase === "active"
                ? "warmAccent"
                : "outline"
          }
        >
          {lifecycle.phase === "ended"
            ? "Event ended"
            : lifecycle.phase === "active"
              ? "Event live"
              : "Event upcoming"}
        </Badge>
      </div>

      {/* Event header */}
      <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--color-terracotta)]">
            Event overview
          </p>
          <h1 className="mt-2 text-[26px] font-medium tracking-[-0.009em] text-[var(--color-ink)]">
            {event.name}
          </h1>
          <p className="mt-1 token-mono text-[12px] text-[var(--color-hint-of-grey)]">
            {event.event_id}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Starts", value: formatTimestamp(event.starts_at) },
              { label: "Ends", value: formatTimestamp(event.ends_at) },
              { label: "Created", value: formatTimestamp(event.created_at) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[16px] bg-[var(--color-fog)] p-3.5"
              >
                <p className="text-[12px] font-medium text-[var(--color-muted-stone)]">
                  {item.label}
                </p>
                <p className="mt-1 text-[14px] text-[var(--color-ink)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Join code card */}
        <div className="w-full max-w-sm rounded-[24px] bg-[var(--color-warm-mist)] p-5">
          <div className="text-[12px] font-medium text-[var(--color-terracotta)]">
            Join code
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="token-mono text-[28px] font-medium tracking-[0.15em] text-[var(--color-ink)]">
              {event.join_code}
            </p>
            <CopyButton label="Join code copied." value={event.join_code} />
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-terracotta)]/80">
            {lifecycle.phase === "ended"
              ? "This event has ended. The join code is kept for audit reference."
              : "Attendees enter this code in the enrollment app to receive the public event bundle."}
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
              {event.pk_gate_event ? (
                <ShieldCheck className="size-4 text-[var(--success)]" />
              ) : (
                <ShieldAlert className="size-4 text-[var(--warning)]" />
              )}
              Gate readiness
            </CardTitle>
            <CardDescription>
              A single gate device is allowed per event. Binding is permanent
              once completed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-[16px] bg-[var(--color-fog)] p-4">
              <p className="text-[14px] leading-relaxed text-[var(--color-ink)]">
                {lifecycle.phase === "ended"
                  ? "This event has ended. No new gate devices or enrollments can be added."
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
                <Link href={`/events/${event.event_id}/revocations`}>
                  Manage revocations
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/events/${event.event_id}/logs`}>
                  View gate logs
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public cryptographic values</CardTitle>
            <CardDescription>
              Safe to share with enrollment and gate apps. These values contain
              no biometric data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <PublicValue label="PK_SIGN_EVENT" value={event.pk_sign_event} />
            <PublicValue label="EVENT_SALT" value={event.event_salt} />
            {event.pk_gate_event ? (
              <PublicValue
                label="PK_GATE_EVENT"
                subtle
                value={event.pk_gate_event}
              />
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
              <div className="rounded-[16px] border border-[var(--color-ink)]/[0.06] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Pass ID</TableHead>
                      <TableHead>Revoked At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revocations.slice(0, 5).map((revocation) => (
                      <TableRow
                        key={`${revocation.event_id}-${revocation.pass_id}`}
                      >
                        <TableCell className="token-mono text-[12px]">
                          {revocation.pass_id}
                        </TableCell>
                        <TableCell className="text-[13px] text-[var(--color-muted-stone)]">
                          {formatTimestamp(revocation.revoked_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-[16px] bg-[var(--color-fog)] px-6 py-10 text-center">
                <Clock3 className="size-5 text-[var(--color-hint-of-grey)]" />
                <p className="text-[14px] font-medium text-[var(--color-ink)]">
                  No revocations yet
                </p>
                <p className="text-[13px] text-[var(--color-muted-stone)]">
                  This event currently has no denied pass IDs.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <GateLogsPanel compact logs={logs} />
      </section>
    </div>
  );
}
