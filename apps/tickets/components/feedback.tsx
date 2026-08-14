import Link from 'next/link';
import { AlertCircle, CalendarDays, Ticket } from 'lucide-react';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingEvents() {
  return (
    <output aria-label="Loading events" aria-live="polite" className="state-ledger state-ledger-loading">
      <div className="state-ledger-label"><span>LOADING</span><strong>Reading public events</strong></div>
      {[0, 1, 2].map((item) => <div aria-hidden="true" className="ledger-skeleton-row" key={item}><Skeleton className="h-12 w-12 rounded-md" /><div><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-5 w-2/3" /><Skeleton className="mt-2 h-3 w-full" /></div><Skeleton className="h-8 w-20 rounded-full" /></div>)}
    </output>
  );
}

export function InlineError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Alert className="state-alert state-ledger-error" variant="destructive">
      <AlertCircle />
      <AlertTitle>Unable to load this view</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {retry ? <AlertAction><Button onClick={retry} size="sm" variant="outline">Try again</Button></AlertAction> : null}
    </Alert>
  );
}

export function EmptyTickets() {
  return (
    <Empty className="empty-state empty-state-ticket">
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
    <Empty className="empty-state empty-state-event">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
        <EmptyTitle>No listed events</EmptyTitle>
        <EmptyDescription>There are no upcoming public events at the moment. Check back after an organizer publishes one.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
