'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react';
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
import { InspectionTicket } from './inspection-ticket';
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
    <main className="ticket-detail-page page-shell inspection-page" id="main-content">
      <div className="ticket-detail-shell">
        <Button asChild className="ticket-detail-back" size="sm" variant="ghost"><Link href="/tickets"><ArrowLeft data-icon="inline-start" />My tickets</Link></Button>
        <div className="ticket-confirmation fade-section">
          <StatusPill status={ticket.status} />
          <p className="ledger-caption">{confirmation ? 'SIGNED PASS CASCADE' : 'REVOCATION INSTRUMENT'}</p>
          <h1>{confirmation ? 'Your place is confirmed.' : ticket.event?.name ?? 'Event ticket'}</h1>
          <p>{confirmation ? 'A real ticket has been created for your account. Keep the claim code available for enrollment.' : 'This is the current authenticated record for the ticket owner.'}</p>
        </div>

        <section className="ticket-artifact-wrap fade-section fade-delay-1" aria-label="Ticket details">
          {ticket.event ? <InspectionTicket claimCode={ticket.claim_code || undefined} event={ticket.event} eyebrow={confirmation ? 'Confirmed admission record' : 'Authenticated ticket record'} status={ticket.status} ticketType={ticket.ticket_type?.name ?? 'Admission'} variant={confirmation ? 'confirmation' : 'detail'} /> : <div className="ticket-data-unavailable"><strong>Event details unavailable</strong><p>The ticket remains owned by this account, but its event record could not be displayed.</p></div>}
        </section>

        <section className="claim-code-register">
          <div><span>{ticket.claim_code ? 'CLAIM CODE' : 'CLAIM CODE UNAVAILABLE'}</span><strong>{ticket.claim_code || `Ends ${ticket.claim_code_hint}`}</strong></div>
          {ticket.claim_code ? <CopyCodeButton code={ticket.claim_code} /> : <p>Recovery is unavailable because this local ticket was encrypted with older server secret material.</p>}
        </section>

        <div className="ticket-next-grid fade-section fade-delay-2">
          <section className="next-step"><p className="ledger-caption">CONTINUE PRIVATELY ON IPHONE</p><h2>{state.label === 'Claimed' ? 'Complete the biometric binding' : state.label}</h2><p>{state.nextStep}</p>{ticket.status === 'claimed' ? <ol><li><span>01</span><div><strong>Open enrollment</strong><p>Use the Focaccia enrollment app on iPhone.</p></div></li><li><span>02</span><div><strong>Use the same account</strong><p>Select this ticket or enter the claim code above.</p></div></li><li><span>03</span><div><strong>Review consent</strong><p>No camera capture begins before the consent boundary.</p></div></li><li><span>04</span><div><strong>Receive the pass</strong><p>The event-scoped credential is encrypted for the gate.</p></div></li></ol> : null}</section>
          <aside className="ticket-actions">
            <p className="ledger-caption">TICKET CONTROLS</p>
            <p>{ticket.event ? `${formatEventDate(ticket.event.starts_at, ticket.event.ends_at)} · ${ticket.event.location || 'Venue unavailable'} · ${formatPrice(ticket.ticket_type?.price_pence ?? 0)}` : 'Event information unavailable'}</p>
            <Button asChild className="w-full" variant="outline"><Link href="/tickets">Back to My tickets</Link></Button>
            {cancellable ? (
              <AlertDialog onOpenChange={setCancelOpen} open={cancelOpen}>
                <AlertDialogTrigger asChild><Button className="w-full" variant="destructive">Cancel ticket</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Cancel this ticket?</AlertDialogTitle><AlertDialogDescription>Cancelling an enrolled ticket revokes its active pass. Cancelled tickets cannot be restored from the attendee app.</AlertDialogDescription></AlertDialogHeader>
                  <Alert className="my-1" variant="destructive"><AlertTriangle /><AlertTitle>This action is terminal</AlertTitle><AlertDescription>The ticket remains in history as Cancelled and can no longer be used for entry.</AlertDescription></Alert>
                  <AlertDialogFooter><AlertDialogCancel disabled={pending}>Keep ticket</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void cancel(); }} variant="destructive">{pending ? 'Cancelling…' : 'Confirm revoke'}</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            {cancelError ? <Alert variant="destructive"><AlertTitle>Cancellation failed</AlertTitle><AlertDescription>{cancelError}</AlertDescription></Alert> : null}
            <small>Checked-in tickets are terminal. Cancelled and revoked tickets cannot be restored here.</small>
          </aside>
        </div>
        <Alert className="ticket-security-note"><ShieldCheck /><AlertTitle>Event-scoped credential</AlertTitle><AlertDescription>Your ticket is tied to this attendee account. Enrollment creates an event-scoped pass; it is not reusable identity.</AlertDescription></Alert>
      </div>
    </main>
  );
}
