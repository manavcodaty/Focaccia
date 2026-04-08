import { prepareCrypto, toBase64Url } from '../_shared/face-pass-shared.ts';

import { jsonError, jsonSuccess, readJsonBody, respondWithError } from '../_shared/api.ts';
import { handleCors } from '../_shared/cors.ts';
import { hasEventEnded } from '../_shared/event-lifecycle.ts';
import { getDefaultPolicy } from '../_shared/policy.ts';
import { randomBytes } from '../_shared/random.ts';
import { setQueueCodeSecret } from '../_shared/secret-store.ts';
import { createAdminClient, requireUser } from '../_shared/supabase.ts';
import type { EventRecord, ProvisionGateRequest, ProvisionGateResponse } from '../_shared/types.ts';

const cryptoReady = prepareCrypto();
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

function validateProvisionGateRequest(body: ProvisionGateRequest): void {
  if (!body.event_id || body.event_id.trim().length === 0) {
    throw new Error('event_id is required.');
  }

  if (!BASE64URL_32_BYTES.test(body.pk_gate_event)) {
    throw new Error('pk_gate_event must be a base64url-encoded 32-byte public key.');
  }

  if (body.device_name !== undefined && body.device_name.trim().length === 0) {
    throw new Error('device_name cannot be blank when provided.');
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Use POST for provision-gate.');
  }

  try {
    await cryptoReady;

    const { userClient } = await requireUser(req);
    const body = await readJsonBody<ProvisionGateRequest>(req);
    validateProvisionGateRequest(body);

    const { data: ownedEvent, error: eventError } = await userClient
      .from('events')
      .select('event_id, event_salt, pk_sign_event, pk_gate_event, starts_at, ends_at')
      .eq('event_id', body.event_id.trim())
      .single();

    if (eventError || !ownedEvent) {
      return jsonError(404, 'event_not_found', 'Event not found or not owned by the caller.');
    }

    if (hasEventEnded(ownedEvent)) {
      return jsonError(
        409,
        'event_ended',
        'This event has already ended and cannot provision new gates.',
      );
    }

    if (ownedEvent.pk_gate_event) {
      return jsonError(409, 'gate_already_provisioned', 'This event already has a gate device.');
    }

    const adminClient = createAdminClient();
    const { data: updatedEvent, error: updateError } = await adminClient
      .from('events')
      .update({
        pk_gate_event: body.pk_gate_event,
      })
      .eq('event_id', body.event_id.trim())
      .is('pk_gate_event', null)
      .select('event_id, event_salt, pk_sign_event, pk_gate_event, starts_at, ends_at')
      .single();

    if (updateError || !updatedEvent) {
      return jsonError(
        409,
        'gate_already_provisioned',
        'The gate was already provisioned by another request.',
      );
    }

    const { error: gateInsertError } = await adminClient.from('gate_devices').insert({
      device_name: body.device_name?.trim() || null,
      event_id: body.event_id.trim(),
      pk_gate_event: body.pk_gate_event,
    });

    if (gateInsertError) {
      await adminClient
        .from('events')
        .update({ pk_gate_event: null })
        .eq('event_id', body.event_id.trim());

      console.error(`Failed to insert gate device for ${body.event_id.trim()}: ${gateInsertError.message}`);
      return jsonError(
        500,
        'gate_insert_failed',
        'Unable to store gate provisioning state.',
      );
    }

    const queueCodeSecret = randomBytes(32);

    try {
      await setQueueCodeSecret(adminClient, body.event_id.trim(), queueCodeSecret);
      const queueCodeSecretBase64Url = await toBase64Url(queueCodeSecret);
      const response: ProvisionGateResponse = {
        ends_at: updatedEvent.ends_at,
        event_id: updatedEvent.event_id,
        event_salt: updatedEvent.event_salt,
        k_code_event: queueCodeSecretBase64Url,
        pk_gate_event: updatedEvent.pk_gate_event ?? body.pk_gate_event,
        pk_sign_event: updatedEvent.pk_sign_event,
        policy: getDefaultPolicy(true),
        starts_at: updatedEvent.starts_at,
      };

      return jsonSuccess(response);
    } finally {
      queueCodeSecret.fill(0);
    }
  } catch (error) {
    return respondWithError(error, {
      code: 'provision_gate_failed',
      message: 'Unable to provision the gate.',
      status: 400,
    });
  }
});
