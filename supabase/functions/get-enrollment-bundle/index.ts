import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireAuthenticated } from '../_shared/auth.ts';
import { claimCodeDigest, protectedServerDigest, validateClaimCode } from '../_shared/claim-code.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { enrollmentSelectorSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

function requestIp(req: Request): string {
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for get-enrollment-bundle.');

  try {
    const { adminClient, user, userClient } = await requireAuthenticated(req);
    const body = await parseJsonBody(req, enrollmentSelectorSchema);
    let query = userClient
      .from('event_tickets')
      .select('id, event_id, ticket_type_id, status, generation_count, current_pass_id')
      .eq('attendee_user_id', user.id)
      .in('status', ['claimed', 'enrolled']);

    if (body.claim_code) {
      const [userScope, ipScope] = await Promise.all([
        protectedServerDigest(`claim:user:${user.id}`),
        protectedServerDigest(`claim:ip:${requestIp(req)}`),
      ]);
      const rateResults = await Promise.all([userScope, ipScope].map((actorScope) =>
        adminClient.rpc('consume_api_rate_limit', {
          p_actor_scope: actorScope,
          p_limit: 10,
          p_operation: 'claim-code-lookup',
          p_window_seconds: 600,
        })
      ));
      const rateError = rateResults.find((result) => result.error)?.error;
      if (rateError) throw databaseApiError(rateError, 'claim_code_rate_limit');
      if (rateResults.some((result) => !(result.data as { allowed: boolean }).allowed)) {
        throw exposedApiError(429, 'rate_limit_exceeded', 'Too many claim-code attempts. Try again later.');
      }
      query = query.eq('claim_code_digest', await claimCodeDigest(validateClaimCode(body.claim_code)));
    } else {
      query = query.eq('id', body.ticket_id);
    }

    const { data: ticket, error: ticketError } = await query.maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return jsonError(req, 404, 'ticket_not_found', 'Ticket not found.');

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('event_id, event_salt, pk_gate_event, pk_sign_event, starts_at, ends_at')
      .eq('event_id', ticket.event_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return jsonError(req, 404, 'ticket_not_found', 'Ticket not found.');
    if (new Date(event.ends_at).getTime() <= Date.now()) {
      return jsonError(req, 409, 'event_ended', 'This event has ended.');
    }
    if (!event.pk_gate_event) {
      return jsonError(req, 409, 'gate_not_provisioned', 'This event is not yet provisioned for enrollment.');
    }

    return jsonSuccess(req, { event, ticket });
  } catch (error) {
    return respondWithError(req, error, {
      code: 'enrollment_bundle_failed',
      message: 'Unable to load the enrollment bundle.',
    });
  }
});
