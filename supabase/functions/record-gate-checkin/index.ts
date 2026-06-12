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
import { gateCheckinSchema } from '../_shared/schemas.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { parseJsonBody } from '../_shared/validation.ts';

const cryptoReady = prepareCrypto();

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for record-gate-checkin.');

  try {
    await cryptoReady;
    const body = await parseJsonBody(req, gateCheckinSchema);
    const admin = createAdminClient();
    const { data: gate, error: gateError } = await admin
      .from('gate_devices')
      .select('id, event_id, sync_public_key, revoked_at')
      .eq('event_id', body.event_id)
      .is('revoked_at', null)
      .maybeSingle();
    if (gateError) throw gateError;
    if (!gate?.sync_public_key) {
      throw exposedApiError(403, 'unknown_gate_key', 'The gate synchronization key is not recognized.');
    }

    const payload = {
      decision: body.decision,
      event_id: body.event_id,
      gate_timestamp: body.gate_timestamp,
      idempotency_key: body.idempotency_key,
      nonce: body.nonce,
      pass_id: body.pass_id,
    } as const;
    const signature = await fromBase64Url(body.signature);
    const publicKey = await fromBase64Url(gate.sync_public_key);
    const valid = await ed25519VerifyDetached(signature, canonicalJsonBytes(payload), publicKey);
    signature.fill(0);
    publicKey.fill(0);
    if (!valid) throw exposedApiError(403, 'invalid_gate_signature', 'The gate signature is invalid.');

    const requestHash = await sha256Hex(new TextDecoder().decode(canonicalJsonBytes(payload)));
    const { data, error } = await admin.rpc('record_gate_checkin', {
      p_decision: payload.decision,
      p_event_id: payload.event_id,
      p_gate_device_id: gate.id,
      p_gate_timestamp: payload.gate_timestamp,
      p_idempotency_key: payload.idempotency_key,
      p_nonce: payload.nonce,
      p_pass_id: payload.pass_id,
      p_request_hash: requestHash,
    });
    if (error || !data) throw databaseApiError(error, 'record_gate_checkin');
    return jsonSuccess(req, data, (data as { idempotent_replay: boolean }).idempotent_replay ? 200 : 201);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'record_gate_checkin_failed',
      message: 'Unable to record the gate check-in.',
    });
  }
});
