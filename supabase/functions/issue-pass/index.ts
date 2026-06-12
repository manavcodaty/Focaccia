import {
  canonicalJsonSignature,
  canonicalJsonStringify,
  prepareCrypto,
  toBase64Url,
  type PassPayload,
} from '../_shared/face-pass-shared.ts';

import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireAuthenticated } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { operationRequestHash, requireIdempotencyKey, sha256Hex } from '../_shared/idempotency.ts';
import { computeQueueCode } from '../_shared/queue-code.ts';
import { issuePassSchema } from '../_shared/schemas.ts';
import { getQueueCodeSecret, getSigningSecret } from '../_shared/secret-store.ts';
import { parseJsonBody } from '../_shared/validation.ts';

const cryptoReady = prepareCrypto();

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for issue-pass.');

  let signingSecret: Uint8Array | undefined;

  try {
    await cryptoReady;
    const { adminClient, user, userClient } = await requireAuthenticated(req);
    const body = await parseJsonBody(req, issuePassSchema);
    const payload = body.payload as PassPayload;
    const { data: ticket, error: ticketError } = await userClient
      .from('event_tickets')
      .select('id, event_id, attendee_user_id, status')
      .eq('id', body.ticket_id)
      .eq('attendee_user_id', user.id)
      .maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) throw exposedApiError(404, 'ticket_not_found', 'Ticket not found.');
    if (payload.event_id !== ticket.event_id) {
      throw exposedApiError(422, 'event_mismatch', 'The pass event does not match the ticket.');
    }

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('event_id, starts_at, ends_at, pk_gate_event')
      .eq('event_id', ticket.event_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) throw exposedApiError(404, 'ticket_not_found', 'Ticket not found.');
    if (!event.pk_gate_event) throw exposedApiError(409, 'gate_not_provisioned', 'The event gate is not provisioned.');

    const eventStart = Math.floor(new Date(event.starts_at).getTime() / 1000);
    const eventEnd = Math.floor(new Date(event.ends_at).getTime() / 1000);
    if (payload.iat < eventStart || payload.exp > eventEnd || payload.iat >= payload.exp) {
      throw exposedApiError(422, 'invalid_pass_window', 'The pass validity window does not match the event.');
    }

    const idempotencyKey = requireIdempotencyKey(req);
    const requestHash = await operationRequestHash('issue-pass', body);
    const payloadHash = await sha256Hex(canonicalJsonStringify(payload));
    signingSecret = await getSigningSecret(adminClient, ticket.event_id);
    const signature = await toBase64Url(await canonicalJsonSignature(payload, signingSecret));
    const { data, error } = await userClient.rpc('issue_ticket_pass', {
      p_idempotency_key: idempotencyKey,
      p_pass_id: payload.pass_id,
      p_payload_hash: payloadHash,
      p_request_hash: requestHash,
      p_ticket_id: body.ticket_id,
      p_valid_from: new Date(payload.iat * 1000).toISOString(),
      p_valid_until: new Date(payload.exp * 1000).toISOString(),
    });
    if (error || !data) throw databaseApiError(error, 'issue_pass');

    const queueSecret = await getQueueCodeSecret(adminClient, ticket.event_id);
    try {
      const queueCode = queueSecret
        ? await computeQueueCode(ticket.event_id, payload.pass_id, queueSecret)
        : undefined;
      return jsonSuccess(req, {
        generation: Number((data as { pass: { generation: number } }).pass.generation),
        idempotent_replay: Boolean((data as { idempotent_replay: boolean }).idempotent_replay),
        ...(queueCode ? { queue_code: queueCode } : {}),
        signature,
      }, (data as { idempotent_replay: boolean }).idempotent_replay ? 200 : 201);
    } finally {
      queueSecret?.fill(0);
    }
  } catch (error) {
    return respondWithError(req, error, {
      code: 'issue_pass_failed',
      message: 'Unable to issue the pass.',
    });
  } finally {
    signingSecret?.fill(0);
  }
});
