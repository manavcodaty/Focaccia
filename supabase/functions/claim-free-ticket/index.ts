import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireAuthenticated } from '../_shared/auth.ts';
import {
  canonicalizeClaimCode,
  claimCodeDigest,
  decryptClaimCode,
  encryptClaimCode,
  generateClaimCode,
} from '../_shared/claim-code.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { operationRequestHash, requireIdempotencyKey } from '../_shared/idempotency.ts';
import { claimTicketSchema } from '../_shared/schemas.ts';
import { sanitizeTicketRecord } from '../_shared/ticket-response.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for claim-free-ticket.');

  try {
    const { userClient } = await requireAuthenticated(req);
    const body = await parseJsonBody(req, claimTicketSchema);
    const idempotencyKey = requireIdempotencyKey(req);
    const requestHash = await operationRequestHash('claim-free-ticket', body);
    const generatedCode = generateClaimCode();
    const canonicalCode = canonicalizeClaimCode(generatedCode);
    const { data, error } = await userClient.rpc('claim_free_ticket', {
      p_claim_code_ciphertext: await encryptClaimCode(generatedCode),
      p_claim_code_digest: await claimCodeDigest(canonicalCode),
      p_claim_code_hint: canonicalCode.slice(-4),
      p_event_id: body.event_id,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_ticket_type_id: body.ticket_type_id,
    });

    if (error || !data) throw databaseApiError(error, 'claim_free_ticket');
    const result = data as { idempotent_replay: boolean; ticket: Record<string, unknown> };
    const claimCode = await decryptClaimCode(String(result.ticket.claim_code_ciphertext));
    return jsonSuccess(req, {
      claim_code: claimCode,
      idempotent_replay: result.idempotent_replay,
      ticket: sanitizeTicketRecord(result.ticket),
    }, result.idempotent_replay ? 200 : 201);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'claim_ticket_failed',
      message: 'Unable to claim the ticket.',
    });
  }
});
