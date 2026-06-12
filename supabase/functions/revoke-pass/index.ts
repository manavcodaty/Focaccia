import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { operationRequestHash, requireIdempotencyKey } from '../_shared/idempotency.ts';
import { sanitizeTicketResult } from '../_shared/ticket-response.ts';
import { idSchema, parseJsonBody, z } from '../_shared/validation.ts';

const schema = z.strictObject({
  event_id: idSchema,
  pass_id: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  reason: z.string().trim().min(1).max(500).default('organizer_revocation'),
});

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for revoke-pass.');

  try {
    const { userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, schema);
    const { data: pass, error: passError } = await userClient
      .from('event_passes')
      .select('ticket_id')
      .eq('event_id', body.event_id)
      .eq('pass_id', body.pass_id)
      .maybeSingle();
    if (passError) throw passError;
    if (!pass) throw exposedApiError(404, 'pass_not_found', 'Pass not found.');

    const idempotencyKey = requireIdempotencyKey(req);
    const { data, error } = await userClient.rpc('revoke_ticket', {
      p_idempotency_key: idempotencyKey,
      p_reason: body.reason,
      p_request_hash: await operationRequestHash('revoke-pass', body),
      p_ticket_id: pass.ticket_id,
    });
    if (error || !data) throw databaseApiError(error, 'revoke_pass');
    return jsonSuccess(req, sanitizeTicketResult(data));
  } catch (error) {
    return respondWithError(req, error, {
      code: 'revoke_pass_failed',
      message: 'Unable to revoke the pass.',
    });
  }
});
