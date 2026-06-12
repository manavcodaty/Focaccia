import type { Metadata } from 'next';

import { EventDetailPage } from '@/components/event-detail-page';

export const metadata: Metadata = { title: 'Event' };

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventDetailPage eventId={eventId} />;
}
