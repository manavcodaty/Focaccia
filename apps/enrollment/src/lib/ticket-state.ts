import type { PassPayload } from '@face-pass/shared';

export type TicketStatus =
  | 'claimed'
  | 'enrolled'
  | 'checked_in'
  | 'cancelled'
  | 'revoked';

export interface TicketEventSummary {
  ends_at: string;
  event_id: string;
  location: string;
  name: string;
  starts_at: string;
}

export interface TicketTypeSummary {
  currency: string;
  id: string;
  name: string;
  price_pence: number;
}

export interface EnrollmentTicket {
  cancelled_at: string | null;
  checked_in_at: string | null;
  claim_code: string;
  claim_code_hint: string;
  claimed_at: string;
  created_at: string;
  current_pass_id: string | null;
  enrolled_at: string | null;
  event: TicketEventSummary;
  event_id: string;
  generation_count: number;
  id: string;
  revoked_at: string | null;
  status: TicketStatus;
  ticket_type: TicketTypeSummary;
  ticket_type_id: string;
  updated_at: string;
}

export interface StoredEnrollmentPass {
  createdAtIso: string;
  event: TicketEventSummary;
  generation: number;
  passId: string;
  queueCode?: string;
  ticketId: string;
  ticketTypeName: string;
  token: string;
  tokenSnippet: string;
  userId: string;
}

export interface PendingPassIssuance {
  createdAtIso: string;
  idempotencyKey: string;
  payload: PassPayload;
  ticketId: string;
  userId: string;
}

export type TicketAction =
  | 'enroll'
  | 'show-pass'
  | 'regenerate'
  | 'generation-limit'
  | 'none';

export function ticketStatusPresentation(status: TicketStatus): {
  label: string;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
} {
  switch (status) {
    case 'claimed':
      return { label: 'Claimed', tone: 'warning' };
    case 'enrolled':
      return { label: 'Enrolled', tone: 'success' };
    case 'checked_in':
      return { label: 'Checked in', tone: 'neutral' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'danger' };
    case 'revoked':
      return { label: 'Revoked', tone: 'danger' };
  }
}

export function generationAllowance(generationCount: number): {
  remaining: number;
  used: number;
} {
  const used = Math.min(3, Math.max(0, Math.trunc(generationCount)));
  return { remaining: 3 - used, used };
}

export function checkedInConfirmation(ticket: EnrollmentTicket): {
  body: string;
  processedAt: string | null;
  title: string;
} | null {
  if (ticket.status !== 'checked_in') {
    return null;
  }

  return {
    body: `The gate authenticated this pass and recorded entry for ${ticket.event.name}.`,
    processedAt: ticket.checked_in_at,
    title: 'Ticket processed and approved',
  };
}

export function ticketAction(
  ticket: EnrollmentTicket,
  storedPass: StoredEnrollmentPass | null,
): TicketAction {
  if (ticket.status === 'claimed') {
    return 'enroll';
  }

  if (ticket.status !== 'enrolled') {
    return 'none';
  }

  if (storedPass && storedPass.passId === ticket.current_pass_id) {
    return 'show-pass';
  }

  return ticket.generation_count >= 3 ? 'generation-limit' : 'regenerate';
}

export function reconcilePassWithTicket(
  ticket: EnrollmentTicket,
  storedPass: StoredEnrollmentPass | null,
): {
  discardPass: boolean;
  reason: 'organizer-reset' | 'pass-replaced' | 'terminal-ticket' | null;
} {
  if (!storedPass) {
    return { discardPass: false, reason: null };
  }

  if (ticket.status === 'claimed' && ticket.generation_count === 0) {
    return { discardPass: true, reason: 'organizer-reset' };
  }

  if (ticket.status === 'checked_in' || ticket.status === 'cancelled' || ticket.status === 'revoked') {
    return { discardPass: true, reason: 'terminal-ticket' };
  }

  if (ticket.status === 'enrolled' && ticket.current_pass_id !== storedPass.passId) {
    return { discardPass: true, reason: 'pass-replaced' };
  }

  return { discardPass: false, reason: null };
}
