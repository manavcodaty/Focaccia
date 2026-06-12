'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [ticket, setTicket] = useState<OwnedTicket | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ticketApi.listMyTickets(session.access_token);
      const found = result.tickets.find((item) => item.id === ticketId) ?? null;
      if (!found && typeof sessionStorage !== 'undefined') {
        const snapshot = sessionStorage.getItem(`focaccia:ticket:${ticketId}`);
        setTicket(snapshot ? JSON.parse(snapshot) as OwnedTicket : null);
      } else {
        setTicket(found);
      }
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
    } catch (failure) {
      setCancelError(failure instanceof Error ? failure.message : 'Unable to cancel this ticket.');
    } finally {
      setPending(false);
    }
  }

  if (authLoading || loading) return <main className="page-shell detail-loading" id="main-content"><div className="detail-skeleton"><span /><span /><span /><span /></div></main>;
  if (error) return <main className="page-shell route-message" id="main-content"><InlineError message={error} retry={() => void load()} /></main>;
  if (!ticket) return <main className="page-shell route-message" id="main-content"><p className="overline">Ticket unavailable</p><h1 className="display-heading">This ticket was not found.</h1><p>It may belong to a different attendee account.</p><Link className="button button-primary" href="/tickets">Open My tickets</Link></main>;

  const state = statusCopy(ticket.status);
  const cancellable = ticket.status === 'claimed' || ticket.status === 'enrolled';

  return (
    <main className="ticket-detail-page" id="main-content">
      <div className="page-shell ticket-detail-shell">
        <div className="ticket-confirmation fade-section">
          <p className="overline">{confirmation ? 'Ticket confirmed' : 'Your ticket'}</p>
          <StatusPill status={ticket.status} />
          <h1 className="display-heading">{confirmation ? 'Your place is saved.' : ticket.event?.name ?? 'Event ticket'}</h1>
          {confirmation ? <p>A real ticket has been created for your account. Keep the claim code available for enrollment.</p> : null}
        </div>

        <section className="ticket-paper fade-section fade-delay-1" aria-label="Ticket details">
          <div className="ticket-paper-main">
            <p className="overline">{ticket.ticket_type?.name ?? 'Admission'}</p>
            <h2>{ticket.event?.name ?? 'Event ticket'}</h2>
            <div className="ticket-information">
              <div><small>Date and time</small><strong>{ticket.event ? formatEventDate(ticket.event.starts_at, ticket.event.ends_at) : 'Unavailable'}</strong></div>
              <div><small>Location</small><strong>{ticket.event?.location || 'Unavailable'}</strong></div>
              <div><small>Total paid</small><strong>{formatPrice(ticket.ticket_type?.price_pence ?? 0)}</strong></div>
            </div>
          </div>
          <div className="ticket-perforation" aria-hidden="true" />
          <div className="claim-code-panel">
            <small>Claim code</small>
            <strong>{ticket.claim_code}</strong>
            <CopyCodeButton code={ticket.claim_code} />
          </div>
        </section>

        <div className="ticket-next-grid fade-section fade-delay-2">
          <section className="next-step"><p className="overline">Next step</p><h2>{state.label === 'Claimed' ? 'Continue in the enrollment app' : state.label}</h2><p>{state.nextStep}</p>{ticket.status === 'claimed' ? <ol><li>Open the Focaccia enrollment app on iPhone.</li><li>Sign in with the same attendee account.</li><li>Select this ticket or enter the claim code above.</li><li>Review consent before any camera capture begins.</li></ol> : null}</section>
          <aside className="ticket-actions"><p className="overline">Ticket controls</p><Link className="button button-ghost button-wide" href="/tickets">Back to My tickets</Link>{cancellable ? <button className="button button-danger button-wide" disabled={pending} onClick={() => void cancel()} type="button">{pending ? 'Cancelling' : 'Cancel ticket'}</button> : null}{cancelError ? <div className="form-error" role="alert">{cancelError}</div> : null}<p>Checked-in tickets are terminal. Cancelled and revoked tickets cannot be restored here.</p></aside>
        </div>
      </div>
    </main>
  );
}
