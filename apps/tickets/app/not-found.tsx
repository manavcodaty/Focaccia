import { TicketXIcon } from 'lucide-react';
import Link from 'next/link';

import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia } from '@/components/ui/empty';

export default function NotFound() {
  return (
    <Page className="justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><TicketXIcon /></EmptyMedia>
          <h1 className="text-lg font-medium tracking-tight">Page not found</h1>
        </EmptyHeader>
        <EmptyContent><Button asChild><Link href="/">Browse events</Link></Button></EmptyContent>
      </Empty>
    </Page>
  );
}
