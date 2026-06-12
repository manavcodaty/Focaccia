import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireAuthenticated } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { decryptClaimCode } from '../_shared/claim-code.ts';
import { emptyBodySchema } from '../_shared/schemas.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { sanitizeTicketRecord } from '../_shared/ticket-response.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for list-my-tickets.');

  try {
    await parseJsonBody(req, emptyBodySchema);
    const { user, userClient } = await requireAuthenticated(req);
    const { data, error } = await userClient
      .from('event_tickets')
      .select('id, event_id, ticket_type_id, status, claim_code_ciphertext, claim_code_hint, generation_count, current_pass_id, claimed_at, enrolled_at, checked_in_at, cancelled_at, revoked_at, created_at, updated_at')
      .eq('attendee_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const eventIds = [...new Set((data ?? []).map((ticket) => ticket.event_id))];
    const typeIds = [...new Set((data ?? []).map((ticket) => ticket.ticket_type_id))];
    const admin = createAdminClient();
    const [eventResult, typeResult] = eventIds.length
      ? await Promise.all([
        admin
          .from('events')
          .select('event_id, name, location, starts_at, ends_at')
          .in('event_id', eventIds),
        admin
          .from('event_ticket_types')
          .select('id, name, price_pence, currency')
          .in('id', typeIds),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (eventResult.error || typeResult.error) throw eventResult.error ?? typeResult.error;

    const tickets = await Promise.all((data ?? []).map(async (ticket) => ({
      ...sanitizeTicketRecord(ticket),
      claim_code: await decryptClaimCode(ticket.claim_code_ciphertext),
      event: (eventResult.data ?? []).find((event) => event.event_id === ticket.event_id) ?? null,
      ticket_type: (typeResult.data ?? []).find((type) => type.id === ticket.ticket_type_id) ?? null,
    })));

    return jsonSuccess(req, { tickets, meta: { next_cursor: null } });
  } catch (error) {
    return respondWithError(req, error, {
      code: 'list_tickets_failed',
      message: 'Unable to load your tickets.',
    });
  }
});
