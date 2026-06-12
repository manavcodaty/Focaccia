import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { publicEventSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for delete-event.');

  try {
    const { userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, publicEventSchema);
    const { data, error } = await userClient
      .from('events')
      .update({ deleted_at: new Date().toISOString(), is_listed: false })
      .eq('event_id', body.event_id)
      .is('deleted_at', null)
      .select('event_id, deleted_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError(req, 404, 'event_not_found', 'Event not found.');
    return jsonSuccess(req, data);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'delete_event_failed',
      message: 'Unable to delete the event.',
    });
  }
});
