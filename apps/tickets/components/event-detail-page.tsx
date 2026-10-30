'use client';

import Link from 'next/link';
import { ArrowLeftIcon, CircleCheckIcon, MapPinIcon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TicketApiError, ticketApi } from '@/lib/api';
import { clearIdempotencyKey, getOrCreateIdempotencyKey } from '@/lib/idempotency';
import { checkoutErrorMessage, formatEventDate, formatEventTimeRange, formatPrice } from '@/lib/presentation';
import type { OwnedTicket, PublicEvent, TicketType } from '@/lib/types';

import { useAuth } from './auth-provider';
import { EventPoster } from './event-poster';
import { Page } from './page';

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Europe/London' });
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/London' });

function DateTile({ value }: { value: string }) {
  const date = new Date(value);
  return (
    <span aria-hidden="true" className="flex size-11 flex-col overflow-hidden rounded-md border text-center">
      <span className="bg-muted py-px text-[10px] font-medium uppercase text-muted-foreground">{monthFormat.format(date)}</span>
      <span className="flex flex-1 items-center justify-center text-base font-semibold tabular-nums">{dayFormat.format(date)}</span>
    </span>
  );
}

function priceLabel(pence: number) {
  return pence === 0 ? 'Free' : formatPrice(pence);
}

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
        ? 'Event unlisted, ended, or unavailable.'
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
    return (
      <Page className="md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
        <Skeleton className="aspect-video w-full rounded-xl md:aspect-square" />
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-4 h-64 w-full rounded-xl" />
        </div>
      </Page>
    );
  }

  if (error || !event) {
    return (
      <Page className="justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><TriangleAlertIcon /></EmptyMedia>
            <h1 className="text-lg font-medium tracking-tight">Event unavailable</h1>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button asChild><Link href="/">Browse events</Link></Button>
            <Button onClick={() => void load()} type="button" variant="outline">Retry</Button>
          </EmptyContent>
        </Empty>
      </Page>
    );
  }

  const ctaLabel = pending ? 'Claiming…' : event.sold_out ? 'Sold out' : selectedType?.price_pence ? 'Paid checkout unavailable' : selectedType?.sold_out ? 'Sold out' : 'Claim ticket';

  return (
    <Page>
      <Button asChild className="-ml-2.5 w-fit" size="sm" variant="ghost"><Link href="/"><ArrowLeftIcon data-icon="inline-start" />Events</Link></Button>

      <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
        <EventPoster className="aspect-[2/1] md:aspect-square" event={event} size="hero" />

        <div className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-balance">{event.name}</h1>
              {event.sold_out ? <span className="text-sm">Sold out</span> : null}
            </div>
            <ItemGroup className="gap-1">
              <Item className="px-0" size="sm">
                <ItemMedia><DateTile value={event.starts_at} /></ItemMedia>
                <ItemContent>
                  <ItemTitle>{formatEventDate(event.starts_at, event.ends_at).split(',').slice(0, 2).join(',')}</ItemTitle>
                  <ItemDescription className="tabular-nums">{formatEventTimeRange(event.starts_at, event.ends_at)}</ItemDescription>
                </ItemContent>
              </Item>
              {event.location ? (
                <Item className="px-0" size="sm">
                  <ItemMedia><span aria-hidden="true" className="flex size-11 items-center justify-center rounded-md border"><MapPinIcon className="size-4" /></span></ItemMedia>
                  <ItemContent><ItemTitle>{event.location}</ItemTitle></ItemContent>
                </Item>
              ) : null}
            </ItemGroup>
          </header>

          <Card aria-labelledby="checkout-heading" role="region">
            <CardHeader>
              <CardTitle id="checkout-heading">Tickets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RadioGroup aria-label="Ticket type" onValueChange={setSelectedTypeId} value={selectedTypeId ?? undefined}>
                {event.ticket_types.map((type) => <TicketTypeOption key={type.id} type={type} />)}
              </RadioGroup>
              {authLoading ? <Skeleton aria-label="Loading account" className="h-14 w-full" /> : user && profile ? (
                <Item size="sm" variant="muted">
                  <ItemMedia variant="icon"><CircleCheckIcon className="text-success" /></ItemMedia>
                  <ItemContent>
                    <ItemTitle>{profile.full_name}</ItemTitle>
                    <ItemDescription>{user.email}</ItemDescription>
                  </ItemContent>
                </Item>
              ) : null}
              {checkoutError ? <Alert variant="destructive"><TriangleAlertIcon /><AlertTitle>{checkoutError}</AlertTitle></Alert> : null}
            </CardContent>
            <CardFooter>
              {user && profile ? (
                <Button className="w-full" disabled={pending || !selectedType?.checkout_available} onClick={() => void checkout()} size="lg" type="button">
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  {ctaLabel}
                </Button>
              ) : user ? (
                <Button asChild className="w-full" size="lg"><Link href={`/profile?next=${encodeURIComponent(`/events/${event.event_id}`)}`}>Complete profile</Link></Button>
              ) : (
                <Button asChild className="w-full" size="lg"><Link href={`/login?next=${encodeURIComponent(`/events/${event.event_id}`)}`}>Sign in to claim</Link></Button>
              )}
            </CardFooter>
          </Card>

          {event.description ? (
            <section aria-labelledby="about-heading" className="flex flex-col gap-2">
              <h2 className="text-base font-semibold" id="about-heading">About</h2>
              <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{event.description}</p>
            </section>
          ) : null}
        </div>
      </div>
    </Page>
  );
}

function TicketTypeOption({ type }: { type: TicketType }) {
  const unavailable = type.price_pence > 0 || type.sold_out;
  const id = `ticket-type-${type.id}`;
  return (
    <FieldLabel htmlFor={id}>
      <Field data-disabled={type.sold_out || undefined} orientation="horizontal">
        <FieldContent>
          <FieldTitle>
            {type.name}
            {unavailable ? <span className="text-sm">{type.sold_out ? 'Sold out' : 'Unavailable'}</span> : null}
          </FieldTitle>
          {type.description ? <FieldDescription>{type.description}</FieldDescription> : null}
        </FieldContent>
        <span className="text-sm font-medium tabular-nums">{priceLabel(type.price_pence)}</span>
        <RadioGroupItem aria-label={`${type.name}, ${priceLabel(type.price_pence)}`} disabled={type.sold_out} id={id} value={type.id} />
      </Field>
    </FieldLabel>
  );
}
