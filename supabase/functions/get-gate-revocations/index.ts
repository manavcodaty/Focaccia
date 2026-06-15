import {
  canonicalJsonBytes,
  ed25519VerifyDetached,
  fromBase64Url,
  prepareCrypto,
} from '../_shared/face-pass-shared.ts';

import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { sha256Hex } from '../_shared/idempotency.ts';
import { gateRevocationRequestSchema } from '../_shared/schemas.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { parseJsonBody } from '../_shared/validation.ts';

const cryptoReady = prepareCrypto();

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') {
    return jsonError(req, 405, 'method_not_allowed', 'Use POST for get-gate-revocations.');
  }

  try {
    await cryptoReady;
    const body = await parseJsonBody(req, gateRevocationRequestSchema);
    const admin = createAdminClient();
    const { data: gate, error: gateError } = await admin
      .from('gate_devices')
      .select('id, event_id, key_version, sync_public_key, revoked_at')
      .eq('event_id', body.event_id)
      .eq('key_version', body.key_version)
      .is('revoked_at', null)
      .maybeSingle();
    if (gateError) throw gateError;
    if (!gate?.sync_public_key) {
      throw exposedApiError(403, 'unknown_gate_key', 'The gate synchronization key is not recognized.');
    }

    const payload = {
      event_id: body.event_id,
      gate_timestamp: body.gate_timestamp,
      idempotency_key: body.idempotency_key,
      key_version: body.key_version,
      nonce: body.nonce,
    } as const;
    const signature = await fromBase64Url(body.signature);
    const publicKey = await fromBase64Url(gate.sync_public_key);
    const payloadBytes = canonicalJsonBytes(payload);
    const valid = await ed25519VerifyDetached(signature, payloadBytes, publicKey);
    signature.fill(0);
    publicKey.fill(0);
    if (!valid) {
      throw exposedApiError(403, 'invalid_gate_signature', 'The gate signature is invalid.');
    }

    const requestHash = await sha256Hex(new TextDecoder().decode(payloadBytes));
    const { data, error } = await admin.rpc('get_gate_revocation_snapshot', {
      p_event_id: payload.event_id,
      p_gate_device_id: gate.id,
      p_gate_timestamp: payload.gate_timestamp,
      p_idempotency_key: payload.idempotency_key,
      p_key_version: payload.key_version,
      p_nonce: payload.nonce,
      p_request_hash: requestHash,
    });
    if (error || !data) throw databaseApiError(error, 'get_gate_revocations');
    return jsonSuccess(req, data);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'get_gate_revocations_failed',
      message: 'Unable to refresh the gate revocation cache.',
    });
  }
});
