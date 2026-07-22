'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CalendarDays, MapPin, ShieldCheck, Ticket } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ticketApi } from '@/lib/api';
import { clearIdempotencyKey, getOrCreateIdempotencyKey } from '@/lib/idempotency';
import { formatEventDate, formatPrice, statusCopy } from '@/lib/presentation';
import type { OwnedTicket } from '@/lib/types';

import { useAuth } from './auth-provider';
import { CopyCodeButton } from './copy-code-button';
import { InlineError } from './feedback';
import { StatusPill } from './status-pill';

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

  if (authLoading || loading) return <main className="page-shell detail-loading" id="main-content"><div className="ticket-detail-skeleton"><Skeleton className="h-5 w-28" /><Skeleton className="h-14 w-3/4" /><Skeleton className="h-80 w-full" /></div></main>;
  if (error) return <main className="page-shell route-message" id="main-content"><InlineError message={error} retry={() => void load()} /></main>;
  if (!ticket) return <main className="page-shell route-message" id="main-content"><p className="overline">Ticket unavailable</p><h1 className="display-heading">This ticket was not found</h1><p>It may belong to a different attendee account.</p><Button asChild><Link href="/tickets">Open My tickets</Link></Button></main>;

  const state = statusCopy(ticket.status);
  const cancellable = ticket.status === 'claimed' || ticket.status === 'enrolled';

  return (
    <main className="ticket-detail-page page-shell" id="main-content">
      <div className="page-shell ticket-detail-shell">
        <Button asChild className="ticket-detail-back" size="sm" variant="ghost"><Link href="/tickets"><ArrowLeft data-icon="inline-start" />My tickets</Link></Button>
        <div className="ticket-confirmation fade-section">
          <p className="overline">{confirmation ? 'Ticket confirmed' : 'Your ticket'}</p>
          <StatusPill status={ticket.status} />
          <h1 className="display-heading">{confirmation ? 'Your place is saved' : ticket.event?.name ?? 'Event ticket'}</h1>
          {confirmation ? <p>A real ticket has been created for your account. Keep the claim code available for enrollment.</p> : null}
        </div>

        <section className="ticket-paper fade-section fade-delay-1" aria-label="Ticket details">
          <div className="ticket-paper-main">
            <div className="ticket-paper-mark" aria-hidden="true"><Ticket /></div>
            <p className="overline">{ticket.ticket_type?.name ?? 'Admission'}</p>
            <h2>{ticket.event?.name ?? 'Event ticket'}</h2>
            <div className="ticket-information">
              <div><small><CalendarDays />Date and time</small><strong>{ticket.event ? formatEventDate(ticket.event.starts_at, ticket.event.ends_at) : 'Unavailable'}</strong></div>
              <div><small><MapPin />Location</small><strong>{ticket.event?.location || 'Unavailable'}</strong></div>
              <div><small>Total paid</small><strong>{formatPrice(ticket.ticket_type?.price_pence ?? 0)}</strong></div>
            </div>
          </div>
          <div className="ticket-perforation" aria-hidden="true" />
          <div className="claim-code-panel">
            <small>{ticket.claim_code ? 'Claim code' : 'Claim code unavailable'}</small>
            <strong>{ticket.claim_code || `Ends ${ticket.claim_code_hint}`}</strong>
            {ticket.claim_code ? <CopyCodeButton code={ticket.claim_code} /> : <p>Claim-code recovery is unavailable because this local ticket was encrypted with older server secret material.</p>}
          </div>
        </section>

        <div className="ticket-next-grid fade-section fade-delay-2">
          <section className="next-step"><p className="overline">Next step</p><h2>{state.label === 'Claimed' ? 'Continue in the enrollment app' : state.label}</h2><p>{state.nextStep}</p>{ticket.status === 'claimed' ? <ol><li>Open the Focaccia enrollment app on iPhone.</li><li>Sign in with the same attendee account.</li><li>Select this ticket or enter the claim code above.</li><li>Review consent before any camera capture begins.</li></ol> : null}</section>
          <aside className="ticket-actions"><p className="overline">Ticket controls</p><Button asChild className="w-full" variant="outline"><Link href="/tickets">Back to My tickets</Link></Button>{cancellable ? <AlertDialog onOpenChange={setCancelOpen} open={cancelOpen}><AlertDialogTrigger asChild><Button className="w-full" variant="destructive">Cancel ticket</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancel this ticket?</AlertDialogTitle><AlertDialogDescription>Cancelling an enrolled ticket revokes its active pass. Cancelled tickets cannot be restored from the attendee app.</AlertDialogDescription></AlertDialogHeader><Alert className="my-1" variant="destructive"><AlertTriangle /><AlertTitle>This action is terminal</AlertTitle><AlertDescription>The ticket will remain in your history as Cancelled and can no longer be used for entry.</AlertDescription></Alert><AlertDialogFooter><AlertDialogCancel disabled={pending}>Keep ticket</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void cancel(); }} variant="destructive">{pending ? 'Cancelling…' : 'Cancel ticket'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}{cancelError ? <Alert variant="destructive"><AlertTitle>Cancellation failed</AlertTitle><AlertDescription>{cancelError}</AlertDescription></Alert> : null}<p>Checked-in tickets are terminal. Cancelled and revoked tickets cannot be restored here.</p></aside>
        </div>
        <Alert className="ticket-security-note"><ShieldCheck /><AlertTitle>Event-scoped credential</AlertTitle><AlertDescription>Your ticket is tied to this attendee account. Enrollment creates an event-scoped pass; it is not reusable identity.</AlertDescription></Alert>
      </div>
    </main>
  );
}
