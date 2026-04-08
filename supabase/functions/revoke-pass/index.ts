import { jsonError, jsonSuccess, readJsonBody, respondWithError } from '../_shared/api.ts';
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
      if (error.message.includes('duplicate key value')) {
        return jsonError(409, 'revoke_pass_failed', 'Pass already revoked.');
      }

      console.error(`Failed to revoke pass ${body.pass_id.trim()} for ${body.event_id.trim()}: ${error.message}`);
      return jsonError(500, 'revoke_pass_failed', 'Unable to revoke the pass.');
    }

    return jsonSuccess(data, 201);
  } catch (error) {
    return respondWithError(error, {
      code: 'revoke_pass_failed',
      message: 'Unable to revoke the pass.',
      status: 400,
    });
  }
});
