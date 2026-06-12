import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { operationRequestHash, requireIdempotencyKey } from '../_shared/idempotency.ts';
import { revokeTicketSchema } from '../_shared/schemas.ts';
import { sanitizeTicketResult } from '../_shared/ticket-response.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for revoke-ticket.');

  try {
    const { userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, revokeTicketSchema);
    const { data, error } = await userClient.rpc('revoke_ticket', {
      p_idempotency_key: requireIdempotencyKey(req),
      p_reason: body.reason,
      p_request_hash: await operationRequestHash('revoke-ticket', body),
      p_ticket_id: body.ticket_id,
    });
    if (error || !data) throw databaseApiError(error, 'revoke_ticket');
    return jsonSuccess(req, sanitizeTicketResult(data));
  } catch (error) {
    return respondWithError(req, error, {
      code: 'revoke_ticket_failed',
      message: 'Unable to revoke the ticket.',
    });
  }
});
