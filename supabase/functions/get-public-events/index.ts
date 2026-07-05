import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { protectedServerDigest } from '../_shared/claim-code.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { ACTIVE_TICKET_STATUSES, buildPublicEvent } from '../_shared/public-ticketing.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { publicEventsSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for get-public-events.');

  try {
    const body = await parseJsonBody(req, publicEventsSchema);
    const admin = createAdminClient();
    const { data: rateLimit, error: rateError } = await admin.rpc('consume_api_rate_limit', {
      p_actor_scope: await protectedServerDigest('public-events:anonymous'),
      p_limit: 600,
      p_operation: 'get-public-events',
      p_window_seconds: 600,
    });
    if (rateError) throw databaseApiError(rateError, 'public_events_rate_limit');
    if (!(rateLimit as { allowed: boolean }).allowed) {
      throw exposedApiError(429, 'rate_limit_exceeded', 'Too many public event requests. Try again later.');
    }
    let query = admin
      .from('events')
      .select('event_id, name, description, location, capacity, starts_at, ends_at, created_at, created_by')
      .eq('is_listed', true)
      .is('deleted_at', null)
      .gt('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(body.limit + 1);

    if (body.cursor) query = query.gt('starts_at', body.cursor);
    const { data: events, error } = await query;
    if (error) throw error;
    const page = (events ?? []).slice(0, body.limit);
    const eventIds = page.map((event) => event.event_id);
    const organizerIds = [...new Set(page.map((event) => event.created_by))];
    const [typeResult, ticketResult, organizerResult] = eventIds.length
      ? await Promise.all([
        admin
        .from('event_ticket_types')
        .select('id, event_id, name, description, price_pence, currency, capacity, sort_order')
        .in('event_id', eventIds)
        .eq('is_active', true)
        .order('sort_order'),
        admin
          .from('event_tickets')
          .select('event_id, ticket_type_id')
          .in('event_id', eventIds)
          .in('status', [...ACTIVE_TICKET_STATUSES]),
        admin
          .from('organizer_profiles')
          .select('user_id, email')
          .in('user_id', organizerIds),
      ])
      : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
    if (typeResult.error || ticketResult.error || organizerResult.error) {
      throw typeResult.error ?? ticketResult.error ?? organizerResult.error;
    }

    const data = page.map((event) => buildPublicEvent({
      activeTickets: ticketResult.data ?? [],
      event,
      organizer: (organizerResult.data ?? []).find((profile) => profile.user_id === event.created_by),
      ticketTypes: typeResult.data ?? [],
    }));

    return jsonSuccess(req, {
      events: data,
      meta: {
        next_cursor: (events?.length ?? 0) > body.limit ? page.at(-1)?.starts_at ?? null : null,
      },
    });
  } catch (error) {
    return respondWithError(req, error, {
      code: 'public_events_failed',
      message: 'Unable to load public events.',
    });
  }
});
