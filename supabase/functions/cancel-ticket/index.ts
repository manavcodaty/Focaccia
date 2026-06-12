import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireAuthenticated } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { operationRequestHash, requireIdempotencyKey } from '../_shared/idempotency.ts';
import { ticketActionSchema } from '../_shared/schemas.ts';
import { sanitizeTicketResult } from '../_shared/ticket-response.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for cancel-ticket.');

  try {
    const { userClient } = await requireAuthenticated(req);
    const body = await parseJsonBody(req, ticketActionSchema);
    const { data, error } = await userClient.rpc('cancel_ticket', {
      p_idempotency_key: requireIdempotencyKey(req),
      p_request_hash: await operationRequestHash('cancel-ticket', body),
      p_ticket_id: body.ticket_id,
    });
    if (error || !data) throw databaseApiError(error, 'cancel_ticket');
    return jsonSuccess(req, sanitizeTicketResult(data));
  } catch (error) {
    return respondWithError(req, error, {
      code: 'cancel_ticket_failed',
      message: 'Unable to cancel the ticket.',
    });
  }
});
