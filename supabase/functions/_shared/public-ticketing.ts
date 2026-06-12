export const ACTIVE_TICKET_STATUSES = ['claimed', 'enrolled', 'checked_in'] as const;

interface EventRow {
  capacity: number;
  created_at: string;
  created_by: string;
  description: string;
  ends_at: string;
  event_id: string;
  location: string;
  name: string;
  starts_at: string;
}

interface TicketTypeRow {
  capacity: number | null;
  currency: string;
  description: string;
  event_id: string;
  id: string;
  name: string;
  price_pence: number;
  sort_order: number;
}

interface ActiveTicketRow {
  event_id: string;
  ticket_type_id: string;
}

interface OrganizerRow {
  email: string;
  user_id: string;
}

export function organizerLabelFromEmail(email: string | undefined): string {
  const localPart = email?.split('@')[0]?.trim() ?? '';
  const words = localPart
    .split(/[._+-]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`);

  return words.length > 0 ? words.join(' ') : 'Focaccia organizer';
}

export function buildPublicEvent({
  activeTickets,
  event,
  organizer,
  ticketTypes,
}: {
  activeTickets: readonly ActiveTicketRow[];
  event: EventRow;
  organizer?: OrganizerRow;
  ticketTypes: readonly TicketTypeRow[];
}) {
  const eventTicketCount = activeTickets.filter((ticket) => ticket.event_id === event.event_id).length;
  const remainingCapacity = Math.max(0, event.capacity - eventTicketCount);
  const soldOut = remainingCapacity === 0;

  return {
    capacity: event.capacity,
    created_at: event.created_at,
    description: event.description,
    ends_at: event.ends_at,
    event_id: event.event_id,
    is_listed: true,
    location: event.location,
    name: event.name,
    organizer: organizerLabelFromEmail(organizer?.email),
    remaining_capacity: remainingCapacity,
    sold_out: soldOut,
    starts_at: event.starts_at,
    ticket_types: ticketTypes
      .filter((type) => type.event_id === event.event_id)
      .map(({ event_id: _eventId, ...type }) => {
        const claimed = activeTickets.filter((ticket) => ticket.ticket_type_id === type.id).length;
        const remaining = type.capacity === null ? remainingCapacity : Math.max(0, type.capacity - claimed);

        return {
          ...type,
          checkout_available: type.price_pence === 0 && !soldOut && remaining > 0,
          remaining_capacity: Math.min(remaining, remainingCapacity),
          sold_out: soldOut || remaining === 0,
        };
      }),
  };
}
