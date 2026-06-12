import { prepareCrypto, toBase64Url } from '../_shared/face-pass-shared.ts';

import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { getDefaultPolicy } from '../_shared/policy.ts';
import { randomBytes } from '../_shared/random.ts';
import { provisionGateSchema } from '../_shared/schemas.ts';
import { encryptServerSecret } from '../_shared/secret-store.ts';
import { parseJsonBody } from '../_shared/validation.ts';

const cryptoReady = prepareCrypto();

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for provision-gate.');

  let queueCodeSecret: Uint8Array | undefined;

  try {
    await cryptoReady;
    const { userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, provisionGateSchema);
    queueCodeSecret = randomBytes(32);
    const { data, error } = await userClient.rpc('provision_event_gate', {
      p_device_name: body.device_name ?? '',
      p_event_id: body.event_id,
      p_pk_gate_event: body.pk_gate_event,
      p_queue_secret_ciphertext: await encryptServerSecret(queueCodeSecret),
      p_sync_public_key: body.sync_public_key,
    });
    if (error || !data) throw databaseApiError(error, 'provision_gate');

    return jsonSuccess(req, {
      ...data,
      k_code_event: await toBase64Url(queueCodeSecret),
      policy: getDefaultPolicy(true),
    });
  } catch (error) {
    return respondWithError(req, error, {
      code: 'provision_gate_failed',
      message: 'Unable to provision the gate.',
    });
  } finally {
    queueCodeSecret?.fill(0);
  }
});
