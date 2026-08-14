import { createEventPoster } from '@/lib/event-poster';
import { formatEventDate } from '@/lib/presentation';
import type { PublicEvent, TicketStatus } from '@/lib/types';

type TicketEvent = Pick<PublicEvent, 'ends_at' | 'event_id' | 'location' | 'name' | 'starts_at'>;

export function InspectionTicket({
  claimCode,
  event,
  eyebrow = 'Signed admission record',
  status,
  stubLabel,
  ticketType = 'General admission',
  variant = 'cascade',
}: {
  claimCode?: string;
  event: TicketEvent;
  eyebrow?: string;
  status?: TicketStatus;
  stubLabel?: string;
  ticketType?: string;
  variant?: 'cascade' | 'confirmation' | 'detail';
}) {
  const poster = createEventPoster(event.event_id, event.name);
  const folio = stubLabel ?? poster.serial;

  return (
    <div className={`inspection-ticket inspection-ticket-${variant}`}>
      {variant === 'cascade' ? (
        <div aria-hidden="true" className="inspection-ticket-underlay">
          <span>ARCHIVAL EVENT FOLIO</span>
          <strong>{formatEventDate(event.starts_at, event.ends_at)}</strong>
          <small>{event.location || 'Venue supplied by organizer'}</small>
        </div>
      ) : null}
      <article aria-label={`${event.name} ticket`} className="inspection-ticket-card">
        <div className="inspection-ticket-main">
          <div className="inspection-ticket-heading">
            <span>{eyebrow}</span>
            <span>FOLIO {poster.serial}</span>
          </div>
          <h2>{event.name}</h2>
          <p>{formatEventDate(event.starts_at, event.ends_at)}</p>
          <div className="inspection-ticket-meta">
            <span>{ticketType}</span>
            <span>{event.location || 'Venue supplied by organizer'}</span>
          </div>
        </div>
        <div className="inspection-ticket-stub">
          <span>{status ? status.replace('_', ' ') : claimCode ? 'claim code' : 'folio'}</span>
          <strong>{claimCode || folio}</strong>
          <small>focaccia / private enrollment</small>
        </div>
      </article>
    </div>
  );
}
