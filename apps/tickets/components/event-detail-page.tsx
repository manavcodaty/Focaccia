'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TicketApiError, ticketApi } from '@/lib/api';
import { clearIdempotencyKey, getOrCreateIdempotencyKey } from '@/lib/idempotency';
import { checkoutErrorMessage, formatEventDate, formatPrice } from '@/lib/presentation';
import type { OwnedTicket, PublicEvent, TicketType } from '@/lib/types';

import { useAuth } from './auth-provider';
import { EventPoster } from './event-poster';
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
    return <main className="page-shell detail-loading" id="main-content"><div className="detail-skeleton"><Skeleton /><div><Skeleton className="h-4 w-28" /><Skeleton className="mt-5 h-12 w-4/5" /><Skeleton className="mt-4 h-5 w-full" /><Skeleton className="mt-3 h-5 w-2/3" /></div></div></main>;
  }

  if (error || !event) {
    return <main className="page-shell route-message" id="main-content"><p className="overline">Event unavailable</p><h1 className="display-heading">This page has no ticket to offer</h1><p>{error}</p><div className="route-actions"><Button asChild><Link href="/">Browse listed events</Link></Button><Button onClick={() => void load()} type="button" variant="outline">Try again</Button></div></main>;
  }

  return (
    <main className="event-detail-page page-shell inspection-page" id="main-content">
      <div className="event-detail-back"><Button asChild size="sm" variant="ghost"><Link href="/"><ArrowLeft data-icon="inline-start" />All events</Link></Button></div>
      <section className="event-docket-grid">
        <div className="event-docket fade-section">
          <div className="event-docket-register"><span>EVENT INSPECTION</span><span>Hosted by {event.organizer}</span></div>
          <h1>{event.name}</h1>
          <dl className="event-docket-facts">
            <div><dt>Date and time</dt><dd>{formatEventDate(event.starts_at, event.ends_at)}</dd></div>
            <div><dt>Location</dt><dd>{event.location || 'Provided by organizer'}</dd></div>
            <div><dt>Availability</dt><dd>{event.sold_out ? 'Sold out' : `${event.remaining_capacity} of ${event.capacity} places remaining`}</dd></div>
          </dl>
        </div>
        <div className="event-index-wrap fade-section fade-delay-1"><EventPoster event={event} size="hero" /></div>
      </section>

      <section className="event-inspection-copy">
        <div><p className="ledger-caption">INSPECTION NOTES</p><h2>About this event</h2></div>
        <p>{event.description || 'The organizer has not added a longer description for this event.'}</p>
      </section>

      <section className="checkout-layout">
        <div className="ticket-types fade-section">
          <div className="ledger-heading compact-heading"><div><h2>Checkout inspection</h2><p>Prices are shown in GBP. Paid checkout is not available in this deployment.</p></div></div>
          <ToggleGroup aria-label="Ticket type" className="ticket-type-list" onValueChange={(value) => value && setSelectedTypeId(value)} orientation="vertical" type="single" value={selectedTypeId ?? undefined} variant="outline">
            {event.ticket_types.map((type) => <TicketTypeOption key={type.id} selected={selectedTypeId === type.id} type={type} />)}
          </ToggleGroup>
          <Alert className="privacy-strip"><ShieldCheck /><AlertTitle>Your ticket, not your face</AlertTitle><AlertDescription>Checkout stores the personal and operational records required for your ticket. Face capture happens later on your iPhone; raw face images are not stored in Supabase. <Link href="/privacy">Read the privacy details.</Link></AlertDescription></Alert>
        </div>

        <aside className="checkout-panel fade-section fade-delay-1" aria-labelledby="checkout-heading">
          <p className="ledger-caption">CLAIM THE PLACE</p>
          <h2 id="checkout-heading">Ticket ownership</h2>
          <div className="summary-line"><span>{selectedType?.name ?? 'Select a ticket'}</span><strong>{selectedType ? formatPrice(selectedType.price_pence) : '—'}</strong></div>
          <div className="summary-total"><span>Total</span><strong>{selectedType ? formatPrice(selectedType.price_pence) : '—'}</strong></div>
          {authLoading ? <Skeleton className="h-32 w-full" aria-label="Loading account" /> : user && profile ? (
            <div className="trusted-owner"><CheckCircle2 /><div><small>Ticket owner</small><strong>{profile.full_name}</strong><span>{user.email}</span><p>Name and email come from your signed-in account.</p></div></div>
          ) : user ? (
            <div className="checkout-notice"><strong>Complete your attendee profile</strong><p>Add the trusted full name that will own this ticket.</p><Button asChild className="w-full"><Link href={`/profile?next=${encodeURIComponent(`/events/${event.event_id}`)}`}>Complete profile</Link></Button></div>
          ) : (
            <div className="checkout-notice"><strong>Sign in to checkout</strong><p>Your account keeps the ticket recoverable across devices.</p><Button asChild className="w-full"><Link href={`/login?next=${encodeURIComponent(`/events/${event.event_id}`)}`}>Sign in to continue</Link></Button></div>
          )}
          {checkoutError ? <Alert variant="destructive"><AlertTitle>Ticket could not be claimed</AlertTitle><AlertDescription>{checkoutError}</AlertDescription></Alert> : null}
          {user && profile ? <Button className="w-full" disabled={pending || !selectedType?.checkout_available} onClick={() => void checkout()} size="lg" type="button">
            {pending ? 'Claiming ticket…' : event.sold_out ? 'Sold out' : selectedType?.price_pence ? 'Paid checkout unavailable' : selectedType?.sold_out ? 'Ticket type sold out' : 'Claim free ticket'}
          </Button> : null}
          <p className="checkout-terms">By claiming a ticket, you confirm the owner details above and accept the event privacy notice.</p>
        </aside>
      </section>
    </main>
  );
}

function TicketTypeOption({ selected, type }: { selected: boolean; type: TicketType }) {
  const unavailable = type.price_pence > 0 || type.sold_out;
  return (
    <ToggleGroupItem aria-label={`${type.name}, ${formatPrice(type.price_pence)}`} className={`ticket-type ${selected ? 'selected' : ''}`} value={type.id}>
      <span className="ticket-type-copy"><strong>{type.name}</strong><small>{type.description || (type.price_pence > 0 ? 'Visible for planning; online payment is not enabled.' : 'Free event admission.')}</small><em>{type.sold_out ? 'Sold out' : type.price_pence > 0 ? 'Unavailable in this deployment' : `${type.remaining_capacity} remaining`}</em></span>
      <span className="ticket-price">{formatPrice(type.price_pence)}{unavailable ? <small>Unavailable</small> : null}</span>
    </ToggleGroupItem>
  );
}
