'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { TicketApiError, ticketApi } from '@/lib/api';
import { clearIdempotencyKey, getOrCreateIdempotencyKey } from '@/lib/idempotency';
import { checkoutErrorMessage, formatEventDate, formatPrice } from '@/lib/presentation';
import type { OwnedTicket, PublicEvent, TicketType } from '@/lib/types';

import { useAuth } from './auth-provider';
import { ArrowIcon, CalendarIcon, LocationIcon, TicketIcon } from './icons';
import { InlineError } from './feedback';

export function EventDetailPage({ eventId }: { eventId: string }) {
  const { loading: authLoading, profile, session, user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ticketApi.getEvent(eventId);
      setEvent(result.event);
      setSelectedTypeId((current) => current ?? result.event.ticket_types.find((type) => type.checkout_available)?.id ?? result.event.ticket_types[0]?.id ?? null);
    } catch (failure) {
      setError(failure instanceof TicketApiError && failure.status === 404
        ? 'This event is not listed, has ended, or does not exist.'
        : failure instanceof Error ? failure.message : 'Unable to load this event.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const selectedType = useMemo(
    () => event?.ticket_types.find((type) => type.id === selectedTypeId) ?? null,
    [event, selectedTypeId],
  );

  async function checkout() {
    if (!session || !profile || !event || !selectedType) return;
    setPending(true);
    setCheckoutError(null);
    const resourceId = `${event.event_id}:${selectedType.id}`;
    const key = getOrCreateIdempotencyKey(sessionStorage, 'checkout', resourceId);
    try {
      const result = await ticketApi.claimFreeTicket(session.access_token, event.event_id, selectedType.id, key);
      clearIdempotencyKey(sessionStorage, 'checkout', resourceId);
      const ticket: OwnedTicket = {
        ...result.ticket,
        claim_code: result.claim_code,
        event: {
          ends_at: event.ends_at,
          event_id: event.event_id,
          location: event.location,
          name: event.name,
          starts_at: event.starts_at,
        },
        ticket_type: {
          currency: selectedType.currency,
          id: selectedType.id,
          name: selectedType.name,
          price_pence: selectedType.price_pence,
        },
      };
      sessionStorage.setItem(`focaccia:ticket:${ticket.id}`, JSON.stringify(ticket));
      router.push(`/confirmation/${ticket.id}`);
    } catch (failure) {
      const code = failure instanceof TicketApiError ? failure.code : 'unknown';
      setCheckoutError(failure instanceof TicketApiError && failure.code === 'network_failed'
        ? failure.message
        : checkoutErrorMessage(code));
      if (['event_sold_out', 'ticket_type_sold_out', 'capacity_exhausted'].includes(code)) await load();
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <main className="page-shell detail-loading" id="main-content"><div className="detail-skeleton"><span /><span /><span /><span /></div></main>;
  }

  if (error || !event) {
    return <main className="page-shell route-message" id="main-content"><p className="overline">Event unavailable</p><h1 className="display-heading">This page has no ticket to offer.</h1><p>{error}</p><div className="route-actions"><Link className="button button-primary" href="/">Browse listed events</Link><button className="button button-ghost" onClick={() => void load()} type="button">Try again</button></div></main>;
  }

  return (
    <main id="main-content">
      <section className="event-hero">
        <div className="page-shell event-hero-grid">
          <div className="fade-section">
            <Link className="back-link" href="/"><span aria-hidden="true">←</span> All events</Link>
            <p className="overline">Listed event · Hosted by {event.organizer}</p>
            <h1 className="display-heading">{event.name}</h1>
            <p className="event-lede">{event.description || 'The organizer has not added a longer description for this event.'}</p>
          </div>
          <div className="event-facts fade-section fade-delay-1">
            <div><CalendarIcon /><span><small>Date and time</small>{formatEventDate(event.starts_at, event.ends_at)}</span></div>
            <div><LocationIcon /><span><small>Location</small>{event.location || 'Provided by organizer'}</span></div>
            <div><TicketIcon /><span><small>Availability</small>{event.sold_out ? 'Sold out' : `${event.remaining_capacity} of ${event.capacity} places remaining`}</span></div>
          </div>
        </div>
      </section>

      <section className="page-shell checkout-layout">
        <div className="ticket-types fade-section fade-delay-1">
          <div className="section-heading compact-heading"><div><p className="overline">Choose a ticket</p><h2>Admission</h2></div><p>Prices are shown in GBP. Paid checkout is intentionally unavailable.</p></div>
          <div className="ticket-type-list">
            {event.ticket_types.map((type) => <TicketTypeOption key={type.id} selected={selectedTypeId === type.id} setSelected={() => setSelectedTypeId(type.id)} type={type} />)}
          </div>
          <div className="privacy-strip"><strong>Your ticket, not your face.</strong><p>Checkout stores your account, ticket state, and claim code. Face capture happens later on your iPhone and is not uploaded.</p><Link href="/privacy">Read the privacy details <ArrowIcon /></Link></div>
        </div>

        <aside className="checkout-panel fade-section fade-delay-2" aria-labelledby="checkout-heading">
          <p className="overline">Order summary</p>
          <h2 id="checkout-heading">Confirm your place</h2>
          <div className="summary-line"><span>{selectedType?.name ?? 'Select a ticket'}</span><strong>{selectedType ? formatPrice(selectedType.price_pence) : '—'}</strong></div>
          <div className="summary-total"><span>Total</span><strong>{selectedType ? formatPrice(selectedType.price_pence) : '—'}</strong></div>
          {authLoading ? <div className="owner-skeleton" aria-label="Loading account" /> : user && profile ? (
            <div className="trusted-owner"><small>Ticket owner</small><strong>{profile.full_name}</strong><span>{user.email}</span><p>Name and email come from your signed-in account.</p></div>
          ) : user ? (
            <div className="checkout-notice"><strong>Complete your attendee profile</strong><p>Add the trusted full name that will own this ticket.</p><Link className="button button-primary button-wide" href={`/profile?next=${encodeURIComponent(`/events/${event.event_id}`)}`}>Complete profile</Link></div>
          ) : (
            <div className="checkout-notice"><strong>Sign in to checkout</strong><p>Your account keeps the ticket recoverable across devices.</p><Link className="button button-primary button-wide" href={`/login?next=${encodeURIComponent(`/events/${event.event_id}`)}`}>Sign in to continue</Link></div>
          )}
          {checkoutError ? <div className="form-error" role="alert">{checkoutError}</div> : null}
          {user && profile ? <button className="button button-primary button-wide" disabled={pending || !selectedType?.checkout_available} onClick={() => void checkout()} type="button">
            {pending ? 'Claiming ticket' : event.sold_out ? 'Sold out' : selectedType?.price_pence ? 'Paid checkout unavailable' : selectedType?.sold_out ? 'Ticket type sold out' : 'Claim free ticket'}
          </button> : null}
          <p className="checkout-terms">By claiming a ticket, you confirm the owner details above and accept the event privacy notice.</p>
        </aside>
      </section>
    </main>
  );
}

function TicketTypeOption({ selected, setSelected, type }: { selected: boolean; setSelected: () => void; type: TicketType }) {
  const unavailable = type.price_pence > 0 || type.sold_out;
  return (
    <button aria-pressed={selected} className={`ticket-type ${selected ? 'selected' : ''}`} onClick={setSelected} type="button">
      <span className="ticket-radio" aria-hidden="true"><span /></span>
      <span className="ticket-type-copy"><strong>{type.name}</strong><small>{type.description || (type.price_pence > 0 ? 'Visible for planning; online payment is not enabled.' : 'Free event admission.')}</small><em>{type.sold_out ? 'Sold out' : type.price_pence > 0 ? 'Unavailable in this deployment' : `${type.remaining_capacity} remaining`}</em></span>
      <span className="ticket-price">{formatPrice(type.price_pence)}{unavailable ? <small>Unavailable</small> : null}</span>
    </button>
  );
}
