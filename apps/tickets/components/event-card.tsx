import Link from 'next/link';

import { formatEventDate, formatPrice } from '@/lib/presentation';
import type { PublicEvent } from '@/lib/types';

import { ArrowIcon, CalendarIcon, LocationIcon } from './icons';

export function EventCard({ event, index }: { event: PublicEvent; index: number }) {
  const lowestPrice = event.ticket_types.reduce((lowest, type) => Math.min(lowest, type.price_pence), Infinity);
  return (
    <article className="event-card fade-section" style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}>
      <div className="event-date-block" aria-hidden="true">
        <span>{new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Europe/London' }).format(new Date(event.starts_at))}</span>
        <strong>{new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'Europe/London' }).format(new Date(event.starts_at))}</strong>
      </div>
      <div className="event-card-main">
        <div className="event-card-heading">
          <div>
            <p className="overline">Hosted by {event.organizer}</p>
            <h2><Link href={`/events/${encodeURIComponent(event.event_id)}`}>{event.name}</Link></h2>
          </div>
          <span className={event.sold_out ? 'availability sold-out' : 'availability'}>
            {event.sold_out ? 'Sold out' : `${event.remaining_capacity} remaining`}
          </span>
        </div>
        <p className="event-description">{event.description || 'Event details are available on the ticket page.'}</p>
        <div className="event-meta">
          <span><CalendarIcon />{formatEventDate(event.starts_at, event.ends_at)}</span>
          <span><LocationIcon />{event.location || 'Location provided by organizer'}</span>
        </div>
      </div>
      <div className="event-card-action">
        <span className="price-label">{lowestPrice === Infinity ? 'Unavailable' : `From ${formatPrice(lowestPrice)}`}</span>
        <Link aria-label={`View ${event.name}`} className="round-link" href={`/events/${encodeURIComponent(event.event_id)}`}><ArrowIcon /></Link>
      </div>
    </article>
  );
}
