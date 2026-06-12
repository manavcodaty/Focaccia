import { ed25519Keypair, prepareCrypto, toBase64Url } from '../_shared/face-pass-shared.ts';

import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { generateJoinCode, randomBytes } from '../_shared/random.ts';
import { createEventSchema } from '../_shared/schemas.ts';
import { encryptServerSecret } from '../_shared/secret-store.ts';
import { parseJsonBody } from '../_shared/validation.ts';

const cryptoReady = prepareCrypto();

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for create-event.');

  let signingPrivateKey: Uint8Array | undefined;
  let eventSaltBytes: Uint8Array | undefined;

  try {
    await cryptoReady;
    const { userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, createEventSchema);
    eventSaltBytes = randomBytes(32);
    const signingKeyPair = await ed25519Keypair();
    signingPrivateKey = signingKeyPair.privateKey;
    const signingSecretCiphertext = await encryptServerSecret(signingPrivateKey);
    const { data, error } = await userClient.rpc('create_event_with_default_ticket_type', {
      p_capacity: body.capacity,
      p_description: body.description,
      p_ends_at: body.ends_at,
      p_event_id: body.event_id,
      p_event_salt: await toBase64Url(eventSaltBytes),
      p_is_listed: body.is_listed,
      p_join_code: generateJoinCode(8),
      p_location: body.location,
      p_name: body.name,
      p_pk_sign_event: await toBase64Url(signingKeyPair.publicKey),
      p_signing_secret_ciphertext: signingSecretCiphertext,
      p_starts_at: body.starts_at,
    });

    if (error || !data) throw databaseApiError(error, 'create_event');
    return jsonSuccess(req, data, 201);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'create_event_failed',
      message: 'Unable to create the event.',
    });
  } finally {
    signingPrivateKey?.fill(0);
    eventSaltBytes?.fill(0);
  }
});
