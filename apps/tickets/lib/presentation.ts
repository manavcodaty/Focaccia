import type { TicketStatus } from './types';

export function formatEventDate(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
    weekday: 'long',
    year: 'numeric',
  }).format(start);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
  return `${date}, ${time.format(start)}-${time.format(end)}`;
}

const LONDON = 'Europe/London';
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LONDON });
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: LONDON, year: 'numeric' });

/** "18:00–21:30" in London time, or "20:05 – Fri 30 Oct, 18:45" when the event runs past midnight. */
export function formatEventTimeRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (eventDayKey(start) === eventDayKey(end)) return `${timeFormat.format(start)}–${timeFormat.format(end)}`;
  const endDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: LONDON, weekday: 'short' }).format(end);
  return `${timeFormat.format(start)} – ${endDay}, ${timeFormat.format(end)}`;
}

/** London calendar day, YYYY-MM-DD, for grouping. */
export function eventDayKey(value: string | Date): string {
  return dayKeyFormat.format(typeof value === 'string' ? new Date(value) : value);
}

/** "Today", "Tomorrow", or "Saturday 1 November" relative to now, in London time. */
export function formatEventDay(startsAt: string, now: Date = new Date()): string {
  const key = eventDayKey(startsAt);
  if (key === eventDayKey(now)) return 'Today';
  if (key === eventDayKey(new Date(now.getTime() + 86_400_000))) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: LONDON,
    weekday: 'long',
    year: key.slice(0, 4) === eventDayKey(now).slice(0, 4) ? undefined : 'numeric',
  }).format(new Date(startsAt));
}

export function formatPrice(pricePence: number): string {
  return new Intl.NumberFormat('en-GB', {
    currency: 'GBP',
    style: 'currency',
  }).format(pricePence / 100);
}

export function statusCopy(status: TicketStatus): { label: string; nextStep: string; tone: string } {
  const values = {
    cancelled: {
      label: 'Cancelled',
      nextStep: 'Invalid. Cannot be restored.',
      tone: 'neutral',
    },
    checked_in: {
      label: 'Checked in',
      nextStep: 'Entry complete. Ticket closed.',
      tone: 'success',
    },
    claimed: {
      label: 'Claimed',
      nextStep: 'Enroll on iPhone with this account.',
      tone: 'warm',
    },
    enrolled: {
      label: 'Enrolled',
      nextStep: 'Show your pass at the gate.',
      tone: 'success',
    },
    revoked: {
      label: 'Revoked',
      nextStep: 'Entry blocked. Contact the organizer.',
      tone: 'danger',
    },
  } as const;

  return values[status];
}

export function checkoutErrorMessage(code: string): string {
  if (['event_sold_out', 'ticket_type_sold_out', 'capacity_exhausted'].includes(code)) {
    return 'The final place was taken. No ticket created.';
  }
  if (code === 'paid_ticket_not_supported') {
    return 'Paid ticket checkout unavailable.';
  }
  if (code === 'ticket_limit_reached') {
    return 'Limit: four tickets per event. Open My tickets.';
  }
  return 'Checkout could not be completed. No place reserved.';
}
