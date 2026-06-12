import { getPublicEnv } from './env';
import type { AttendeeProfile, OwnedTicket, PublicEvent } from './types';

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
  ok?: false;
  request_id?: string;
}

interface SuccessEnvelope<T> {
  data: T;
  ok: true;
  request_id: string;
}

export class TicketApiError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(message: string, { code = 'request_failed', requestId, status }: {
    code?: string;
    requestId?: string;
    status: number;
  }) {
    super(message);
    this.code = code;
    this.name = 'TicketApiError';
    this.requestId = requestId;
    this.status = status;
  }
}

async function invoke<T>(name: string, {
  accessToken,
  body,
  idempotencyKey,
}: {
  accessToken?: string;
  body: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<T> {
  const env = getPublicEnv();
  let response: Response;

  try {
    response = await fetch(`${env.supabaseUrl}/functions/v1/${name}`, {
      body: JSON.stringify(body),
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${accessToken ?? env.anonKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new TicketApiError(
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The request timed out. Check the selected network mode and try again.'
        : 'The ticket service is unreachable. Check your connection and selected network mode.',
      { code: 'network_failed', status: 0 },
    );
  }

  const payload = await response.json().catch(() => null) as SuccessEnvelope<T> | ErrorEnvelope | null;
  if (!response.ok || !payload || payload.ok !== true) {
    const failure = payload as ErrorEnvelope | null;
    throw new TicketApiError(
      failure?.error?.message ?? 'The ticket service returned an invalid response.',
      {
        code: failure?.error?.code,
        requestId: failure?.request_id,
        status: response.status,
      },
    );
  }

  return payload.data;
}

export const ticketApi = {
  cancelTicket(accessToken: string, ticketId: string, idempotencyKey: string) {
    return invoke<{ idempotent_replay: boolean; ticket: OwnedTicket }>('cancel-ticket', {
      accessToken,
      body: { ticket_id: ticketId },
      idempotencyKey,
    });
  },
  claimFreeTicket(accessToken: string, eventId: string, ticketTypeId: string, idempotencyKey: string) {
    return invoke<{ claim_code: string; idempotent_replay: boolean; ticket: OwnedTicket }>('claim-free-ticket', {
      accessToken,
      body: { event_id: eventId, ticket_type_id: ticketTypeId },
      idempotencyKey,
    });
  },
  ensureAttendee(accessToken: string, fullName: string) {
    return invoke<AttendeeProfile>('ensure-attendee', {
      accessToken,
      body: { full_name: fullName },
    });
  },
  getEvent(eventId: string) {
    return invoke<{ event: PublicEvent }>('get-public-event', { body: { event_id: eventId } });
  },
  getEvents() {
    return invoke<{ events: PublicEvent[]; meta: { next_cursor: string | null } }>('get-public-events', {
      body: { limit: 50 },
    });
  },
  listMyTickets(accessToken: string) {
    return invoke<{ tickets: OwnedTicket[]; meta: { next_cursor: null } }>('list-my-tickets', {
      accessToken,
      body: {},
    });
  },
};
