import { exposedApiError, hiddenApiError } from './api.ts';

const ERROR_MAP: Readonly<Record<string, { status: number; message: string }>> = {
  attendee_profile_required: { status: 403, message: 'Complete your attendee profile first.' },
  capacity_below_allocated: { status: 409, message: 'Capacity cannot be lower than allocated tickets.' },
  event_ended: { status: 409, message: 'This event has ended.' },
  event_not_available: { status: 404, message: 'Event not found.' },
  event_not_owned: { status: 403, message: 'You do not own this event.' },
  event_or_join_code_exists: { status: 409, message: 'The event identifier is already in use.' },
  event_sold_out: { status: 409, message: 'This event is sold out.' },
  gate_not_provisioned: { status: 409, message: 'The event gate is not provisioned.' },
  gate_already_provisioned: { status: 409, message: 'This event already has a gate device.' },
  gate_nonce_replay: { status: 409, message: 'The gate nonce has already been used.' },
  idempotency_conflict: { status: 409, message: 'The idempotency key was already used for a different request.' },
  invalid_gate_decision: { status: 422, message: 'The gate decision is invalid.' },
  invalid_pass_window: { status: 422, message: 'The pass validity window does not match the event.' },
  organizer_required: { status: 403, message: 'Organizer access is required.' },
  paid_ticket_unavailable: { status: 409, message: 'Paid tickets are not available in this deployment.' },
  pass_generation_limit: { status: 409, message: 'This ticket has reached its pass generation limit.' },
  pass_not_active: { status: 409, message: 'The pass is no longer active.' },
  pass_not_found: { status: 404, message: 'Pass not found.' },
  stale_gate_timestamp: { status: 409, message: 'The gate timestamp is outside the accepted window.' },
  ticket_already_exists: { status: 409, message: 'You already have a ticket for this event.' },
  ticket_not_found: { status: 404, message: 'Ticket not found.' },
  ticket_state_conflict: { status: 409, message: 'The ticket cannot be changed from its current state.' },
  ticket_type_not_available: { status: 404, message: 'Ticket type not found.' },
  ticket_type_not_found: { status: 404, message: 'Ticket type not found.' },
  ticket_type_sold_out: { status: 409, message: 'This ticket type is sold out.' },
  unknown_gate_key: { status: 403, message: 'The gate synchronization key is not recognized.' },
};

export function databaseApiError(error: { message?: string } | null, operation: string): Error {
  const raw = error?.message ?? '';

  for (const [code, mapped] of Object.entries(ERROR_MAP)) {
    if (raw.includes(code)) {
      return exposedApiError(mapped.status, code, mapped.message);
    }
  }

  return hiddenApiError({
    code: `${operation}_database_failed`,
    message: `${operation} database failure: ${raw || 'unknown error'}`,
  });
}
