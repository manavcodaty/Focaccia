import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { EventRouteTabs } from "@/components/dashboard/event-route-tabs";
import { GateLogsPanel } from "@/components/dashboard/gate-logs-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEventDetail } from "@/lib/data";

export default async function EventLogsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { event, logs } = await getEventDetail(eventId);

  return (
    <div className="fade-section flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant="outline">
          <Link href={`/events/${event.event_id}`}>
            <ArrowLeft data-icon="inline-start" />
            Event overview
          </Link>
        </Button>
        <Badge variant="outline">{event.name}</Badge>
      </div>

      <EventRouteTabs eventId={event.event_id} />
      <GateLogsPanel eventId={event.event_id} logs={logs} />
    </div>
  );
}
