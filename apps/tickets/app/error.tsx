'use client';

import { TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';

import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia } from '@/components/ui/empty';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page className="justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><TriangleAlertIcon /></EmptyMedia>
          <h1 className="text-lg font-medium tracking-tight">Something went wrong</h1>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button onClick={reset} type="button">Retry</Button>
          <Button asChild variant="outline"><Link href="/tickets">My tickets</Link></Button>
        </EmptyContent>
      </Empty>
    </Page>
  );
}
