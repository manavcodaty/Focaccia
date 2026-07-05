import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { protectedServerDigest } from '../_shared/claim-code.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { ACTIVE_TICKET_STATUSES, buildPublicEvent } from '../_shared/public-ticketing.ts';
import { publicEventSchema } from '../_shared/schemas.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for get-public-event.');

  try {
    const body = await parseJsonBody(req, publicEventSchema);
    const admin = createAdminClient();
    const { data: rateLimit, error: rateError } = await admin.rpc('consume_api_rate_limit', {
      p_actor_scope: await protectedServerDigest('public-events:anonymous'),
      p_limit: 600,
      p_operation: 'get-public-event',
      p_window_seconds: 600,
    });
    if (rateError) throw databaseApiError(rateError, 'public_event_rate_limit');
    if (!(rateLimit as { allowed: boolean }).allowed) {
      throw exposedApiError(429, 'rate_limit_exceeded', 'Too many public event requests. Try again later.');
    }
    const { data: event, error } = await admin
      .from('events')
      .select('event_id, name, description, location, capacity, starts_at, ends_at, created_at, created_by')
      .eq('event_id', body.event_id)
      .eq('is_listed', true)
      .is('deleted_at', null)
      .gt('ends_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    if (!event) return jsonError(req, 404, 'event_not_found', 'Event not found.');

    const [typeResult, ticketResult, organizerResult] = await Promise.all([
      admin
        .from('event_ticket_types')
        .select('id, event_id, name, description, price_pence, currency, capacity, sort_order')
        .eq('event_id', event.event_id)
        .eq('is_active', true)
        .order('sort_order'),
      admin
        .from('event_tickets')
        .select('event_id, ticket_type_id')
        .eq('event_id', event.event_id)
        .in('status', [...ACTIVE_TICKET_STATUSES]),
      admin
        .from('organizer_profiles')
        .select('user_id, email')
        .eq('user_id', event.created_by)
        .maybeSingle(),
    ]);
    if (typeResult.error || ticketResult.error || organizerResult.error) {
      throw typeResult.error ?? ticketResult.error ?? organizerResult.error;
    }

    return jsonSuccess(req, {
      event: buildPublicEvent({
        activeTickets: ticketResult.data ?? [],
        event,
        organizer: organizerResult.data ?? undefined,
        ticketTypes: typeResult.data ?? [],
      }),
    });
  } catch (error) {
    return respondWithError(req, error, {
      code: 'public_event_failed',
      message: 'Unable to load the public event.',
    });
  }
});
