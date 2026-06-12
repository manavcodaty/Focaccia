import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireAuthenticated } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { ensureAttendeeSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for ensure-attendee.');

  try {
    const { userClient } = await requireAuthenticated(req);
    const body = await parseJsonBody(req, ensureAttendeeSchema);
    const { data, error } = await userClient.rpc('ensure_attendee_profile', {
      p_full_name: body.full_name,
    });
    if (error || !data) throw databaseApiError(error, 'ensure_attendee');
    return jsonSuccess(req, data);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'ensure_attendee_failed',
      message: 'Unable to save the attendee profile.',
    });
  }
});
