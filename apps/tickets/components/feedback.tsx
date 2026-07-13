import Link from 'next/link';
import { AlertCircle, CalendarDays, Ticket } from 'lucide-react';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingEvents() {
  return (
    <output aria-label="Loading events" aria-live="polite" className="event-grid">
      {[0, 1, 2].map((item) => <div aria-hidden="true" className="event-skeleton" key={item}><Skeleton className="event-skeleton-poster" /><div><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-8 w-4/5" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-2 h-4 w-2/3" /></div></div>)}
    </output>
  );
}

export function InlineError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Alert className="state-alert" variant="destructive">
      <AlertCircle />
      <AlertTitle>Unable to load this view</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {retry ? <AlertAction><Button onClick={retry} size="sm" variant="outline">Try again</Button></AlertAction> : null}
    </Alert>
  );
}

export function EmptyTickets() {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Ticket /></EmptyMedia>
        <EmptyTitle>No tickets yet</EmptyTitle>
        <EmptyDescription>Claim a free place from a listed event. Your ticket remains recoverable with the same attendee account.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent><Button asChild><Link href="/">Browse events</Link></Button></EmptyContent>
    </Empty>
  );
}

export function EmptyEvents() {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
        <EmptyTitle>No listed events</EmptyTitle>
        <EmptyDescription>There are no upcoming public events at the moment. Check back after an organizer publishes one.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
