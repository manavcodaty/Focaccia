import { TicketDetailPage } from '@/components/ticket-detail-page';

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <TicketDetailPage ticketId={ticketId} />;
}
