import { MapPinIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EventRouteTabs } from "@/components/dashboard/event-route-tabs";
import { LifecycleText } from "@/components/dashboard/events-data-table";
import { PageHeader } from "@/components/page-header";
import { getEventLifecycleState } from "@/lib/event-lifecycle";
import type { EventRecord } from "@/lib/types";

export function EventHeader({
  actions,
  counts,
  event,
}: {
  actions?: ReactNode;
  counts?: Partial<Record<"/revocations" | "/logs", number>>;
  event: EventRecord;
}) {
  const { phase } = getEventLifecycleState(event);

  return (
    <PageHeader
      actions={actions}
      description={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <LifecycleText phase={phase} />
            {event.is_listed ? null : <span className="text-sm">Unlisted</span>}
          </span>
          {event.location ? <span className="inline-flex items-center gap-1.5"><MapPinIcon className="size-3.5" />{event.location}</span> : null}
        </div>
      }
      title={event.name}
    >
      <EventRouteTabs counts={counts} eventId={event.event_id} />
    </PageHeader>
  );
}
