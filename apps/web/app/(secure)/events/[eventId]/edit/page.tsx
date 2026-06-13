import { EventForm } from "@/components/dashboard/event-form";
import { getEventDetail } from "@/lib/data";

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await getEventDetail(eventId);

  return <EventForm initialEvent={event} mode="edit" />;
}
