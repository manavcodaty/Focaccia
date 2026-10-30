import type { Metadata } from "next";

import { EventHeader } from "@/components/dashboard/event-header";
import { GateLogsPanel } from "@/components/dashboard/gate-logs-panel";
import { getEventDetail } from "@/lib/data";

export const metadata: Metadata = { title: "Gate logs" };

export default async function EventLogsPage({
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
        <GateLogsPanel logs={logs} />
      </div>
    </div>
  );
}
