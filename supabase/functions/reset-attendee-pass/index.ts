import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { operationRequestHash, requireIdempotencyKey } from '../_shared/idempotency.ts';
import { ticketActionSchema } from '../_shared/schemas.ts';
import { sanitizeTicketResult } from '../_shared/ticket-response.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for reset-attendee-pass.');

  try {
    const { userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, ticketActionSchema);
    const { data, error } = await userClient.rpc('reset_attendee_pass', {
      p_idempotency_key: requireIdempotencyKey(req),
      p_request_hash: await operationRequestHash('reset-attendee-pass', body),
      p_ticket_id: body.ticket_id,
    });
    if (error || !data) throw databaseApiError(error, 'reset_attendee_pass');
    return jsonSuccess(req, sanitizeTicketResult(data));
  } catch (error) {
    return respondWithError(req, error, {
      code: 'reset_attendee_pass_failed',
      message: 'Unable to reset the attendee pass.',
    });
  }
});
