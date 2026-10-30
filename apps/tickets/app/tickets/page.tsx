import type { Metadata } from 'next';

import { MyTicketsPage } from '@/components/my-tickets-page';

export const metadata: Metadata = { title: 'My tickets' };

export default function TicketsPage() {
  return <MyTicketsPage />;
}
