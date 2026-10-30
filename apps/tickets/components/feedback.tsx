import { AlertCircleIcon, CalendarIcon, SearchXIcon, TicketIcon } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemContent, ItemGroup, ItemMedia } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingEvents({ label = 'Loading events' }: { label?: string }) {
  return (
    <output aria-label={label} aria-live="polite" className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      <ItemGroup className="gap-3">
        {[0, 1, 2].map((item) => (
          <Item aria-hidden="true" key={item} variant="outline">
            <ItemMedia className="size-14" variant="image"><Skeleton className="size-full" /></ItemMedia>
            <ItemContent className="gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/2" />
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </output>
  );
}

export function InlineError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{message}</AlertTitle>
      {retry ? <AlertAction><Button onClick={retry} size="sm" variant="outline">Retry</Button></AlertAction> : null}
    </Alert>
  );
}

export function EmptyTickets() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon"><TicketIcon /></EmptyMedia>
        <EmptyTitle>No tickets</EmptyTitle>
      </EmptyHeader>
      <EmptyContent><Button asChild><Link href="/">Browse events</Link></Button></EmptyContent>
    </Empty>
  );
}

export function EmptyEvents() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarIcon /></EmptyMedia>
        <EmptyTitle>No events</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

export function NoMatchingEvents({ reset }: { reset: () => void }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
        <EmptyTitle>No results</EmptyTitle>
      </EmptyHeader>
      <EmptyContent><Button onClick={reset} variant="outline">Clear search</Button></EmptyContent>
    </Empty>
  );
}
