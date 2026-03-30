import Link from "next/link";
import { ArrowLeft, ScanLine, ShieldAlert, ShieldCheck } from "lucide-react";

import { CopyButton } from "@/components/dashboard/copy-button";
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
import { Separator } from "@/components/ui/separator";
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
    <div className="space-y-8">
      <section className="fade-section flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
          <Badge variant={event.pk_gate_event ? "success" : "warning"}>
            {event.pk_gate_event ? "Gate provisioned" : "Gate not provisioned"}
          </Badge>
        </div>
        <Card className="overflow-hidden border-[color:var(--border-strong)]">
          <CardContent className="grid gap-6 p-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                Event overview
              </div>
              <h1 className="poster-title text-5xl leading-none text-[color:var(--foreground)]">
                {event.name}
              </h1>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                    Event ID
                  </div>
                  <div className="mt-2 font-mono text-sm text-[color:var(--foreground)]">{event.event_id}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                    Starts
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--foreground)]">{formatTimestamp(event.starts_at)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                    Ends
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--foreground)]">{formatTimestamp(event.ends_at)}</div>
                </div>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--background)]/78 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
                    Join code
                  </div>
                  <div className="mt-3 font-mono text-4xl tracking-[0.24em] text-[color:var(--foreground)]">
                    {event.join_code}
                  </div>
                </div>
                <CopyButton label="Join code copied." value={event.join_code} />
              </div>
              <p className="mt-4 text-sm leading-6 text-[color:var(--muted-foreground)]">
                Attendees enter this code in the enrollment app to receive the public event bundle.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="fade-section fade-delay-1 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gate provisioning state</CardTitle>
              <CardDescription>
                One event, one gate. The gate phone will generate the encryption keypair on-device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--accent)] p-4">
                {event.pk_gate_event ? (
                  <ShieldCheck className="mt-1 size-5 text-emerald-600" />
                ) : (
                  <ShieldAlert className="mt-1 size-5 text-amber-600" />
                )}
                <div>
                  <div className="font-medium text-[color:var(--foreground)]">
                    {event.pk_gate_event ? "This event already has its bound gate." : "No gate has claimed this event yet."}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    Provisioning is irreversible at the event level. Only the first gate device registration is accepted.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link href={`/events/${event.event_id}/provisioning`}>
                  Open provisioning page
                  <ScanLine className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Public cryptographic values</CardTitle>
              <CardDescription>
                These values are safe to display and distribute to the enrollment and gate apps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PublicValue label="PK_SIGN_EVENT" value={event.pk_sign_event} />
              <PublicValue label="EVENT_SALT" value={event.event_salt} />
              {event.pk_gate_event ? (
                <PublicValue label="PK_GATE_EVENT" value={event.pk_gate_event} />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revocations</CardTitle>
              <CardDescription>
                Server-side list of pass identifiers that the gate must reject during offline sync windows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {revocations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pass ID</TableHead>
                      <TableHead>Revoked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revocations.map((revocation) => (
                      <TableRow key={`${revocation.event_id}-${revocation.pass_id}`}>
                        <TableCell className="font-mono text-xs">{revocation.pass_id}</TableCell>
                        <TableCell>{formatTimestamp(revocation.revoked_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border)] p-4 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  No passes have been revoked yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logs</CardTitle>
              <CardDescription>
                Uploaded gate CSV exports appear here when the operations app starts publishing them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="space-y-3 rounded-[1.5rem] border border-[color:var(--border)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">CSV upload</Badge>
                      <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                        {formatTimestamp(log.uploaded_at)}
                      </span>
                    </div>
                    <Separator />
                    {log.csv_url ? (
                      <Button asChild variant="outline">
                        <a href={log.csv_url}>Download CSV</a>
                      </Button>
                    ) : (
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        No downloadable URL was stored for this upload.
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border)] p-4 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  No gate logs uploaded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
