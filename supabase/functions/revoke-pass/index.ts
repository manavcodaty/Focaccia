import { jsonError, jsonSuccess, readJsonBody } from '../_shared/api.ts';
import { handleCors } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
import type { RevokePassRequest } from '../_shared/types.ts';

function validateRevokePassRequest(body: RevokePassRequest): void {
  if (!body.event_id || body.event_id.trim().length === 0) {
    throw new Error('event_id is required.');
  }

  if (!body.pass_id || body.pass_id.trim().length === 0) {
    throw new Error('pass_id is required.');
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Use POST for revoke-pass.');
  }

  try {
    const { userClient } = await requireUser(req);
    const body = await readJsonBody<RevokePassRequest>(req);
    validateRevokePassRequest(body);

    const { data, error } = await userClient
      .from('revocations')
      .insert({
        event_id: body.event_id.trim(),
        pass_id: body.pass_id.trim(),
      })
      .select('event_id, pass_id, revoked_at')
      .single();

    if (error) {
      const status = error.message.includes('duplicate key value') ? 409 : 400;
      return jsonError(status, 'revoke_pass_failed', error.message);
    }

    return jsonSuccess(data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    const status = message === 'Missing bearer token.' || message === 'Authentication failed.'
      ? 401
      : 400;

    return jsonError(status, 'revoke_pass_failed', message);
  }
});
