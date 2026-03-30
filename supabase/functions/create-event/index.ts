import { ed25519Keypair, prepareCrypto, toBase64Url } from '../_shared/face-pass-shared.ts';

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/api.ts';
import { handleCors } from '../_shared/cors.ts';
import { generateJoinCode, randomBytes } from '../_shared/random.ts';
import { createEventSecretRecord } from '../_shared/secret-store.ts';
import { createAdminClient, requireUser } from '../_shared/supabase.ts';
import type { CreateEventRequest, CreateEventResponse } from '../_shared/types.ts';

const cryptoReady = prepareCrypto();

function isUniqueViolation(message: string, constraint: string): boolean {
  return message.includes('duplicate key value violates unique constraint')
    && message.includes(constraint);
}

function validateCreateEventRequest(body: CreateEventRequest): void {
  if (!body.event_id || body.event_id.trim().length === 0) {
    throw new Error('event_id is required.');
  }

  if (!body.name || body.name.trim().length === 0) {
    throw new Error('name is required.');
  }

  const startsAt = Number(new Date(body.starts_at));
  const endsAt = Number(new Date(body.ends_at));

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    throw new Error('starts_at and ends_at must be valid ISO-8601 timestamps.');
  }

  if (startsAt >= endsAt) {
    throw new Error('starts_at must be earlier than ends_at.');
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Use POST for create-event.');
  }

  try {
    await cryptoReady;

    const { user, userClient } = await requireUser(req);
    const body = await readJsonBody<CreateEventRequest>(req);
    validateCreateEventRequest(body);

    const eventSaltBytes = randomBytes(32);
    const signingKeyPair = await ed25519Keypair();
    const eventSalt = await toBase64Url(eventSaltBytes);
    const publicSigningKey = await toBase64Url(signingKeyPair.publicKey);
    const adminClient = createAdminClient();

    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const joinCode = generateJoinCode(8);
        const { data, error } = await userClient
          .from('events')
          .insert({
            created_by: user.id,
            ends_at: body.ends_at,
            event_id: body.event_id.trim(),
            event_salt: eventSalt,
            join_code: joinCode,
            name: body.name.trim(),
            pk_sign_event: publicSigningKey,
            starts_at: body.starts_at,
          })
          .select('event_id, join_code, event_salt, pk_sign_event, starts_at, ends_at')
          .single();

        if (error) {
          if (isUniqueViolation(error.message, 'events_join_code_key')) {
            continue;
          }

          throw new Error(error.message);
        }

        if (!data) {
          throw new Error('Event creation did not return a row.');
        }

        try {
          await createEventSecretRecord(adminClient, body.event_id.trim(), signingKeyPair.privateKey);
        } catch (error) {
          await userClient.from('events').delete().eq('event_id', body.event_id.trim());
          throw error;
        }

        const response: CreateEventResponse = {
          ends_at: data.ends_at,
          event_id: data.event_id,
          event_salt: data.event_salt,
          join_code: data.join_code,
          pk_sign_event: data.pk_sign_event,
          starts_at: data.starts_at,
        };

        return jsonSuccess(response, 201);
      }

      return jsonError(500, 'join_code_exhausted', 'Failed to allocate a unique join code.');
    } finally {
      eventSaltBytes.fill(0);
      signingKeyPair.privateKey.fill(0);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    const status = message === 'Missing bearer token.' || message === 'Authentication failed.'
      ? 401
      : message.includes('duplicate key value')
        ? 409
        : 400;

    return jsonError(status, 'create_event_failed', message);
  }
});
