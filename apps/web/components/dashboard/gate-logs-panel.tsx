import { DownloadIcon, FileClockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { GateLogRecord } from "@/lib/types";

export function GateLogsPanel({ logs }: { logs: GateLogRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gate logs</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <Table aria-label="Gate log uploads" className="min-w-[28rem]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="tabular-nums">{formatTimestamp(log.uploaded_at)}</TableCell>
                    <TableCell className="text-right">
                      {log.csv_url ? (
                        <Button asChild size="sm" variant="ghost">
                          <a href={log.csv_url}><DownloadIcon data-icon="inline-start" />Download CSV</a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileClockIcon /></EmptyMedia>
              <EmptyTitle>No logs</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
