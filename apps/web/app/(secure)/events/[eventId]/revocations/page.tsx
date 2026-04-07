import Link from "next/link";
import { ArrowLeft, TicketSlash } from "lucide-react";

import { EventRouteTabs } from "@/components/dashboard/event-route-tabs";
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

export default async function EventRevocationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { event, revocations } = await getEventDetail(eventId);

  return (
    <div className="fade-section flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button asChild size="sm" variant="outline">
          <Link href={`/events/${event.event_id}`}>
            <ArrowLeft className="size-3.5" />
            Event overview
          </Link>
        </Button>
        <Badge variant="outline">{event.name}</Badge>
      </div>

      <EventRouteTabs eventId={event.event_id} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Revocations</CardTitle>
              <CardDescription>
                Denied pass IDs for this event. Gate devices sync against this list before operations start.
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
                  {revocations.map((revocation) => (
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
                  <TicketSlash />
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
    </div>
  );
}
