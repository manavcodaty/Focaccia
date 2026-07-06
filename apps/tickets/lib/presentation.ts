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
      nextStep: 'This ticket is no longer valid and cannot be reactivated.',
      tone: 'neutral',
    },
    checked_in: {
      label: 'Checked in',
      nextStep: 'Entry is complete. This single-use ticket is now closed.',
      tone: 'success',
    },
    claimed: {
      label: 'Claimed',
      nextStep: 'Sign in to the Focaccia enrollment app and select this ticket or enter its claim code.',
      tone: 'warm',
    },
    enrolled: {
      label: 'Enrolled',
      nextStep: 'Your signed event pass is ready in the enrollment app. Present it at the gate.',
      tone: 'success',
    },
    revoked: {
      label: 'Revoked',
      nextStep: 'This ticket and any issued pass are no longer valid. Contact the organizer for help.',
      tone: 'danger',
    },
  } as const;

  return values[status];
}

export function checkoutErrorMessage(code: string): string {
  if (['event_sold_out', 'ticket_type_sold_out', 'capacity_exhausted'].includes(code)) {
    return 'The final place was taken before checkout completed. No ticket was created.';
  }
  if (code === 'paid_ticket_not_supported') {
    return 'Paid ticket checkout is not available in this EPQ deployment.';
  }
  if (code === 'ticket_limit_reached') {
    return 'You already hold four tickets for this event. Open My tickets to manage them.';
  }
  return 'Checkout could not be completed. Your place has not been reserved.';
}
