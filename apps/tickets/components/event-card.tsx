import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createEventPoster } from '@/lib/event-poster';
import { formatEventDate, formatPrice } from '@/lib/presentation';
import type { PublicEvent } from '@/lib/types';

export function EventCard({ event, index }: { event: PublicEvent; index: number }) {
  const lowestPrice = event.ticket_types.reduce((lowest, type) => Math.min(lowest, type.price_pence), Infinity);
  const poster = createEventPoster(event.event_id, event.name);
  return (
    <article className="event-ledger-row fade-section" style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}>
      <div aria-hidden="true" className="event-ledger-folio"><span>{String(index + 1).padStart(2, '0')}</span><small>{poster.serial}</small></div>
      <div className="event-ledger-identity">
        <p>{event.organizer}</p>
        <h2><Link href={`/events/${encodeURIComponent(event.event_id)}`}>{event.name}</Link></h2>
        <small>{event.description || 'Event details are available on the ticket page.'}</small>
      </div>
      <div className="event-ledger-facts">
        <span>{formatEventDate(event.starts_at, event.ends_at)}</span>
        <span>{event.location || 'Location provided by organizer'}</span>
      </div>
      <div className="event-ledger-availability">
        <strong>{event.sold_out ? 'Sold out' : `${event.remaining_capacity} places`}</strong>
        <span>{lowestPrice === Infinity ? 'Unavailable' : `From ${formatPrice(lowestPrice)}`}</span>
      </div>
      <Button asChild size="sm" variant="outline"><Link aria-label={`View ${event.name}`} href={`/events/${encodeURIComponent(event.event_id)}`}>Inspect<ArrowUpRight data-icon="inline-end" /></Link></Button>
    </article>
  );
}
