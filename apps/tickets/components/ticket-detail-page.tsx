'use client';

import Link from 'next/link';
import { ArrowLeftIcon, CalendarIcon, CircleCheckIcon, MapPinIcon, TicketXIcon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ticketApi } from '@/lib/api';
import { clearIdempotencyKey, getOrCreateIdempotencyKey } from '@/lib/idempotency';
import { formatEventDate, formatEventTimeRange } from '@/lib/presentation';
import type { OwnedTicket } from '@/lib/types';

import { useAuth } from './auth-provider';
import { CopyCodeButton } from './copy-code-button';
import { EventPoster } from './event-poster';
import { InlineError } from './feedback';
import { Page, SectionHeading } from './page';
import { StatusText } from './status-text';

const enrollmentSteps = ['Open PrivatePass on iPhone', 'Sign in with this account', 'Select this ticket'];

export function TicketDetailPage({ ticketId, confirmation = false }: { confirmation?: boolean; ticketId: string }) {
  const { loading: authLoading, session, user } = useAuth();
  const router = useRouter();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [ticket, setTicket] = useState<OwnedTicket | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ticketApi.listMyTickets(session.access_token);
      const found = result.tickets.find((item) => item.id === ticketId) ?? null;
      setTicket(found);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to load this ticket.');
    } finally {
      setLoading(false);
    }
  }, [session, ticketId]);

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/login?next=${encodeURIComponent(confirmation ? `/confirmation/${ticketId}` : `/tickets/${ticketId}`)}`);
    if (session) void load();
  }, [authLoading, confirmation, load, router, session, ticketId, user]);

  async function cancel() {
    if (!session || !ticket) return;
    setPending(true);
    setCancelError(null);
    const key = getOrCreateIdempotencyKey(sessionStorage, 'cancel', ticket.id);
    try {
      await ticketApi.cancelTicket(session.access_token, ticket.id, key);
      clearIdempotencyKey(sessionStorage, 'cancel', ticket.id);
      await load();
      setCancelOpen(false);
    } catch (failure) {
      setCancelError(failure instanceof Error ? failure.message : 'Unable to cancel this ticket.');
    } finally {
      setPending(false);
    }
  }

  if (authLoading || loading) {
    return (
      <Page>
        <div aria-busy="true" className="flex flex-col gap-8">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </Page>
    );
  }
  if (error) return <Page><InlineError message={error} retry={() => void load()} /></Page>;
  if (!ticket) {
    return (
      <Page className="justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><TicketXIcon /></EmptyMedia>
            <h1 className="text-lg font-medium tracking-tight">Ticket not found</h1>
          </EmptyHeader>
          <EmptyContent><Button asChild><Link href="/tickets">My tickets</Link></Button></EmptyContent>
        </Empty>
      </Page>
    );
  }

  const cancellable = ticket.status === 'claimed' || ticket.status === 'enrolled';
  const name = ticket.event?.name ?? 'Event ticket';

  return (
    <Page>
      <Button asChild className="-ml-2.5 w-fit" size="sm" variant="ghost"><Link href="/tickets"><ArrowLeftIcon data-icon="inline-start" />My tickets</Link></Button>

      <header className="flex items-center gap-3">
        {confirmation ? <CircleCheckIcon aria-hidden="true" className="size-6 shrink-0 text-success" /> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{confirmation ? 'Your place is saved' : name}</h1>
      </header>

      <Card aria-label="Ticket details" className="max-w-2xl gap-0 py-0" role="region">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center gap-4">
            <div className="size-14 shrink-0 overflow-hidden rounded-md"><EventPoster event={{ event_id: ticket.event_id, name }} /></div>
            <div className="flex min-w-0 flex-col gap-1">
              {confirmation ? <h2 className="truncate text-base font-semibold">{name}</h2> : null}
              <div className="flex flex-wrap items-center gap-2"><StatusText status={ticket.status} /><span className="text-sm text-muted-foreground">{ticket.ticket_type?.name ?? 'Admission'}</span></div>
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {ticket.event ? (
              <li className="flex items-center gap-2 tabular-nums"><CalendarIcon className="size-4 text-muted-foreground" />{formatEventDate(ticket.event.starts_at, ticket.event.ends_at).split(',').slice(0, 2).join(',')} · {formatEventTimeRange(ticket.event.starts_at, ticket.event.ends_at)}</li>
            ) : null}
            {ticket.event?.location ? <li className="flex items-center gap-2"><MapPinIcon className="size-4 text-muted-foreground" />{ticket.event.location}</li> : null}
          </ul>
        </div>
        <div aria-hidden="true" className="relative">
          <Separator className="border-t border-dashed bg-transparent" />
          <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-background ring-1 ring-foreground/10" />
          <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-background ring-1 ring-foreground/10" />
        </div>
        <div className="flex flex-col gap-4 bg-muted/40 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Claim code</span>
            <span className="font-mono text-2xl font-medium tracking-[0.18em] sm:text-3xl">{ticket.claim_code || `•••• ${ticket.claim_code_hint}`}</span>
          </div>
          {ticket.claim_code ? <CopyCodeButton code={ticket.claim_code} /> : null}
        </div>
      </Card>

      {ticket.status === 'claimed' ? (
        <section aria-labelledby="next-heading" className="flex flex-col gap-3">
          <SectionHeading id="next-heading">Next</SectionHeading>
          <ol className="flex flex-col gap-2 text-sm">
            {enrollmentSteps.map((step, index) => (
              <li className="flex items-center gap-3" key={step}>
                <span aria-hidden="true" className="text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {cancelError ? <Alert variant="destructive"><TriangleAlertIcon /><AlertTitle>{cancelError}</AlertTitle></Alert> : null}

      {cancellable ? (
        <AlertDialog onOpenChange={setCancelOpen} open={cancelOpen}>
          <AlertDialogTrigger asChild><Button className="w-fit" variant="destructive">Cancel ticket</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this ticket?</AlertDialogTitle>
              <AlertDialogDescription>It cannot be restored.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Keep ticket</AlertDialogCancel>
              <AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void cancel(); }} variant="destructive">
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? 'Cancelling…' : 'Cancel ticket'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </Page>
  );
}
