import Link from "next/link";
import { FileClock } from "lucide-react";

import type { GateLogRecord } from "@/lib/types";
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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function GateLogsPanel({
  compact = false,
  eventId,
  logs,
}: {
  compact?: boolean;
  eventId?: string;
  logs: GateLogRecord[];
}) {
  const visibleLogs = compact ? logs.slice(0, 5) : logs;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Gate logs</CardTitle>
            <CardDescription>
              Review uploaded CSV exports from the bound gate device for this event.
            </CardDescription>
          </div>
          <Badge variant="outline">{logs.length} total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {visibleLogs.length > 0 ? (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>CSV Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-[color:var(--foreground)]">
                      {formatTimestamp(log.uploaded_at)}
                    </TableCell>
                    <TableCell>
                      {log.csv_url ? (
                        <Link
                          className="font-medium text-[color:var(--primary)] underline-offset-4 hover:underline"
                          href={log.csv_url}
                        >
                          Open CSV
                        </Link>
                      ) : (
                        <span className="text-sm text-[color:var(--muted-foreground)]">Missing file reference</span>
                      )}
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
                <FileClock />
              </EmptyMedia>
              <EmptyTitle>No logs uploaded yet</EmptyTitle>
              <EmptyDescription>
                Gate CSV exports will appear here once operators upload them after the event.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {!compact && eventId ? (
          <div className="mt-4 flex justify-end">
            <Button asChild variant="outline">
              <Link href={`/events/${eventId}`}>Back to overview</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
