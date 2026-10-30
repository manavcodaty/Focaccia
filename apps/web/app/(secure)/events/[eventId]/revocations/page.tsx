import { TicketSlashIcon } from "lucide-react";
import type { Metadata } from "next";

import { EventHeader } from "@/components/dashboard/event-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEventDetail } from "@/lib/data";
import { formatTimestamp } from "@/lib/format-timestamp";

export const metadata: Metadata = { title: "Revocations" };

export default async function EventRevocationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { event, logs, revocations } = await getEventDetail(eventId);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <EventHeader counts={{ "/logs": logs.length, "/revocations": revocations.length }} event={event} />
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Revocations</CardTitle>
          </CardHeader>
          <CardContent>
            {revocations.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <Table aria-label="Revoked passes" className="min-w-[32rem]">
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Pass ID</TableHead>
                      <TableHead className="text-right">Revoked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revocations.map((revocation) => (
                      <TableRow key={`${revocation.event_id}-${revocation.pass_id}`}>
                        <TableCell className="font-mono text-xs">{revocation.pass_id}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{formatTimestamp(revocation.revoked_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><TicketSlashIcon /></EmptyMedia>
                  <EmptyTitle>No revocations</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
