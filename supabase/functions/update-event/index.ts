import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { protectedServerDigest } from '../_shared/claim-code.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { updateEventSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for update-event.');

  try {
    const { adminClient, user, userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, updateEventSchema);
    const { data: rateLimit, error: rateError } = await adminClient.rpc('consume_api_rate_limit', {
      p_actor_scope: await protectedServerDigest(`organizer:${user.id}`),
      p_limit: 60,
      p_operation: 'update-event',
      p_window_seconds: 600,
    });
    if (rateError) throw databaseApiError(rateError, 'update_event_rate_limit');
    if (!(rateLimit as { allowed: boolean }).allowed) {
      throw exposedApiError(429, 'rate_limit_exceeded', 'Too many event updates. Try again later.');
    }
    const { data, error } = await userClient.rpc('update_event_catalogue', {
      p_capacity: body.capacity,
      p_description: body.description,
      p_ends_at: body.ends_at,
      p_event_id: body.event_id,
      p_is_listed: body.is_listed,
      p_location: body.location,
      p_name: body.name,
      p_starts_at: body.starts_at,
    });
    if (error || !data) throw databaseApiError(error, 'update_event');
    return jsonSuccess(req, data);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'update_event_failed',
      message: 'Unable to update the event.',
    });
  }
});
