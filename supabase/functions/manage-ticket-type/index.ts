import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { manageTicketTypeSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for manage-ticket-type.');

  try {
    const { userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, manageTicketTypeSchema);
    const { data, error } = await userClient.rpc('manage_event_ticket_type', {
      p_capacity: body.capacity,
      p_description: body.description,
      p_event_id: body.event_id,
      p_is_active: body.is_active,
      p_name: body.name,
      p_price_pence: body.price_pence,
      p_sort_order: body.sort_order,
      p_ticket_type_id: body.ticket_type_id,
    });
    if (error || !data) throw databaseApiError(error, 'manage_ticket_type');
    return jsonSuccess(req, data, body.ticket_type_id ? 200 : 201);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'manage_ticket_type_failed',
      message: 'Unable to save the ticket type.',
    });
  }
});
