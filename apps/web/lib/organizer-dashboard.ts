import type { EventLifecyclePhase } from "./event-lifecycle.ts";
import type { TicketStatus } from "./types.ts";

export function buildPublicTicketUrl(ticketsUrl: string, eventId: string): string {
  return `${ticketsUrl.replace(/\/+$/, "")}/events/${encodeURIComponent(eventId)}`;
}

interface FilterableEvent {
  readonly event_id: string;
  readonly is_listed: boolean;
  readonly lifecycle: EventLifecyclePhase;
  readonly name: string;
}

export interface OrganizerEventFilters {
  readonly lifecycle: EventLifecyclePhase | "all";
  readonly listed: "all" | "listed" | "unlisted";
  readonly query: string;
}

export function filterOrganizerEvents<T extends FilterableEvent>(
  events: readonly T[],
  filters: OrganizerEventFilters,
): T[] {
  const query = filters.query.trim().toLowerCase();

  return events.filter((event) => {
    const matchesQuery = query.length === 0
      || event.name.toLowerCase().includes(query)
      || event.event_id.toLowerCase().includes(query);
    const matchesLifecycle = filters.lifecycle === "all" || event.lifecycle === filters.lifecycle;
    const matchesListed = filters.listed === "all"
      || (filters.listed === "listed" ? event.is_listed : !event.is_listed);

    return matchesQuery && matchesLifecycle && matchesListed;
  });
}

interface FilterableTicket {
  readonly attendee_email: string;
  readonly attendee_name: string;
  readonly status: TicketStatus;
  readonly ticket_type_name: string;
}

export interface OrganizerTicketFilters {
  readonly query: string;
  readonly status: TicketStatus | "all";
  readonly ticketType: string | "all";
}

export function filterOrganizerTickets<T extends FilterableTicket>(
  tickets: readonly T[],
  filters: OrganizerTicketFilters,
): T[] {
  const query = filters.query.trim().toLowerCase();

  return tickets.filter((ticket) => {
    const matchesQuery = query.length === 0
      || ticket.attendee_name.toLowerCase().includes(query)
      || ticket.attendee_email.toLowerCase().includes(query);
    const matchesStatus = filters.status === "all" || ticket.status === filters.status;
    const matchesType = filters.ticketType === "all" || ticket.ticket_type_name === filters.ticketType;

    return matchesQuery && matchesStatus && matchesType;
  });
}
