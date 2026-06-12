import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { publicEventSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for organizer-ticket-summaries.');

  try {
    const { userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, publicEventSchema);
    const { data: event, error: eventError } = await userClient
      .from('events')
      .select('event_id, name, capacity, is_listed, starts_at, ends_at')
      .eq('event_id', body.event_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return jsonError(req, 404, 'event_not_found', 'Event not found.');

    const [{ data: tickets, error: ticketError }, { data: activity, error: activityError }, { data: checkins, error: checkinError }] = await Promise.all([
      userClient
        .from('event_tickets')
        .select('id, ticket_type_id, attendee_user_id, status, claim_code_hint, generation_count, current_pass_id, claimed_at, enrolled_at, checked_in_at, cancelled_at, revoked_at')
        .eq('event_id', body.event_id)
        .order('created_at', { ascending: false }),
      userClient
        .from('ticket_activity_log')
        .select('id, ticket_id, activity_type, from_status, to_status, pass_id, metadata, created_at')
        .eq('event_id', body.event_id)
        .order('created_at', { ascending: false })
        .limit(500),
      userClient
        .from('gate_checkins')
        .select('id, ticket_id, pass_id, decision, gate_timestamp, received_at')
        .eq('event_id', body.event_id)
        .order('received_at', { ascending: false })
        .limit(500),
    ]);
    if (ticketError || activityError || checkinError) throw ticketError ?? activityError ?? checkinError;

    const counts = Object.fromEntries(
      ['claimed', 'enrolled', 'checked_in', 'cancelled', 'revoked'].map((status) => [
        status,
        (tickets ?? []).filter((ticket) => ticket.status === status).length,
      ]),
    );
    return jsonSuccess(req, { activity: activity ?? [], checkins: checkins ?? [], counts, event, tickets: tickets ?? [] });
  } catch (error) {
    return respondWithError(req, error, {
      code: 'organizer_ticket_summaries_failed',
      message: 'Unable to load organizer ticket summaries.',
    });
  }
});
