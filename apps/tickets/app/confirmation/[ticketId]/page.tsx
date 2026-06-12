import { TicketDetailPage } from '@/components/ticket-detail-page';

export default async function ConfirmationPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <TicketDetailPage confirmation ticketId={ticketId} />;
}
