import { EventOperationsWorkspace } from "@/components/dashboard/event-operations-workspace";
import { getEventOperations } from "@/lib/data";
import { getPublicEnv } from "@/lib/env";
import { buildPublicTicketUrl } from "@/lib/organizer-dashboard";

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const operations = await getEventOperations(eventId);
  const env = getPublicEnv();
  const publicTicketUrl = buildPublicTicketUrl(env.ticketsUrl, operations.event.event_id);

  return (
    <EventOperationsWorkspace
      networkLabel={env.mode === "local" ? "Local network" : "Secure tunnel"}
      operations={operations}
      publicTicketUrl={publicTicketUrl}
    />
  );
}
