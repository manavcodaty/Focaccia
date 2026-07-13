import Link from 'next/link';
import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEventDate, formatPrice } from '@/lib/presentation';
import type { PublicEvent } from '@/lib/types';

import { EventPoster } from './event-poster';

export function EventCard({ event, index }: { event: PublicEvent; index: number }) {
  const lowestPrice = event.ticket_types.reduce((lowest, type) => Math.min(lowest, type.price_pence), Infinity);
  return (
    <article className="event-card fade-section" style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}>
      <Link className="event-card-poster-link" href={`/events/${encodeURIComponent(event.event_id)}`} tabIndex={-1}><EventPoster event={event} /></Link>
      <div className="event-card-main">
        <div className="event-card-heading"><p className="overline">Hosted by {event.organizer}</p><Badge className={event.sold_out ? 'availability sold-out' : 'availability'} variant="outline">{event.sold_out ? 'Sold out' : `${event.remaining_capacity} remaining`}</Badge></div>
        <h2><Link href={`/events/${encodeURIComponent(event.event_id)}`}>{event.name}</Link></h2>
        <p className="event-description">{event.description || 'Event details are available on the ticket page.'}</p>
        <div className="event-meta">
          <span><CalendarDays />{formatEventDate(event.starts_at, event.ends_at)}</span>
          <span><MapPin />{event.location || 'Location provided by organizer'}</span>
        </div>
        <div className="event-card-action">
          <span className="price-label">{lowestPrice === Infinity ? 'Unavailable' : `From ${formatPrice(lowestPrice)}`}</span>
          <Button asChild size="sm" variant="outline"><Link aria-label={`View ${event.name}`} href={`/events/${encodeURIComponent(event.event_id)}`}>View event<ArrowUpRight data-icon="inline-end" /></Link></Button>
        </div>
      </div>
    </article>
  );
}
