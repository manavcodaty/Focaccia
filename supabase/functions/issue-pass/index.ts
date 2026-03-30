import {
  canonicalJsonBytes,
  canonicalJsonSignature,
  prepareCrypto,
  toBase64Url,
  type PassPayload,
} from '../_shared/face-pass-shared.ts';

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/api.ts';
import { handleCors } from '../_shared/cors.ts';
import { computeQueueCode } from '../_shared/queue-code.ts';
import { getQueueCodeSecret, getSigningSecret } from '../_shared/secret-store.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import type { EventRecord, IssuePassRequest, IssuePassResponse } from '../_shared/types.ts';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

const cryptoReady = prepareCrypto();

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function validatePassPayload(payload: PassPayload, event: Pick<EventRecord, 'ends_at' | 'event_id' | 'pk_gate_event' | 'starts_at'>): void {
  if (payload.v !== 1) {
    throw new Error('payload.v must equal 1.');
  }

  if (payload.event_id !== event.event_id) {
    throw new Error('payload.event_id does not match the requested event.');
  }

  if (!payload.single_use) {
    throw new Error('payload.single_use must be true.');
  }

  if (!BASE64URL_PATTERN.test(payload.pass_id) || !BASE64URL_PATTERN.test(payload.nonce)) {
    throw new Error('pass_id and nonce must be base64url strings.');
  }

  if (!BASE64URL_PATTERN.test(payload.enc_template)) {
    throw new Error('enc_template must be base64url encoded.');
  }

  if (!isFiniteInteger(payload.iat) || !isFiniteInteger(payload.exp)) {
    throw new Error('iat and exp must be integer UNIX seconds.');
  }

  if (payload.iat > payload.exp) {
    throw new Error('iat must not be later than exp.');
  }

  const eventStartsAtUnix = Math.floor(new Date(event.starts_at).getTime() / 1000);
  const eventEndsAtUnix = Math.floor(new Date(event.ends_at).getTime() / 1000);

  if (payload.iat < eventStartsAtUnix) {
    throw new Error('iat must not be earlier than the event start time.');
  }

  if (payload.exp > eventEndsAtUnix) {
    throw new Error('exp must not be later than the event end time.');
  }

  const nowUnix = Math.floor(Date.now() / 1000);

  if (nowUnix > eventEndsAtUnix) {
    throw new Error('This event has already ended.');
  }

  if (!event.pk_gate_event) {
    throw new Error('This event has not been provisioned with a gate device.');
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Use POST for issue-pass.');
  }

  try {
    await cryptoReady;

    const requestBody = await readJsonBody<IssuePassRequest | PassPayload>(req);
    const payload = 'payload' in requestBody ? requestBody.payload : requestBody;
    const adminClient = createAdminClient();
    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('event_id, starts_at, ends_at, pk_gate_event')
      .eq('event_id', payload.event_id)
      .single();

    if (eventError || !event) {
      return jsonError(404, 'event_not_found', 'Event not found.');
    }

    validatePassPayload(payload, event);

    const signingSecret = await getSigningSecret(adminClient, payload.event_id);

    try {
      const signatureBytes = await canonicalJsonSignature(payload, signingSecret);
      const signature = await toBase64Url(signatureBytes);
      const queueCodeSecret = await getQueueCodeSecret(adminClient, payload.event_id);
      const queueCode = queueCodeSecret
        ? await computeQueueCode(payload.event_id, payload.pass_id, queueCodeSecret)
        : undefined;

      const response: IssuePassResponse = {
        queue_code: queueCode,
        signature,
      };

      return jsonSuccess(response);
    } finally {
      signingSecret.fill(0);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    const status = message.includes('not found')
      ? 404
      : message.includes('not been provisioned') || message.includes('already ended')
        ? 409
        : 400;

    return jsonError(status, 'issue_pass_failed', message);
  }
});
