import { jsonError, jsonSuccess, readJsonBody, respondWithError } from '../_shared/api.ts';
import { handleCors } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
import type { DeleteEventRequest, DeleteEventResponse } from '../_shared/types.ts';

function validateDeleteEventRequest(body: DeleteEventRequest): void {
  if (!body.event_id || body.event_id.trim().length === 0) {
    throw new Error('event_id is required.');
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Use POST for delete-event.');
  }

  try {
    const { userClient } = await requireUser(req);
    const body = await readJsonBody<DeleteEventRequest>(req);
    validateDeleteEventRequest(body);

    const { data, error } = await userClient
      .from('events')
      .delete()
      .eq('event_id', body.event_id.trim())
      .select('event_id')
      .single();

    if (error || !data) {
      return jsonError(404, 'event_not_found', 'Event not found or not owned by the caller.');
    }

    const response: DeleteEventResponse = {
      event_id: data.event_id,
    };

    return jsonSuccess(response);
  } catch (error) {
    return respondWithError(error, {
      code: 'delete_event_failed',
      message: 'Unable to delete the event.',
      status: 400,
    });
  }
});
