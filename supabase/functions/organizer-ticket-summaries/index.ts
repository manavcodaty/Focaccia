import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { protectedServerDigest } from '../_shared/claim-code.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { publicEventSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for organizer-ticket-summaries.');

  try {
    const { adminClient, user, userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, publicEventSchema);
    const { data: rateLimit, error: rateError } = await adminClient.rpc('consume_api_rate_limit', {
      p_actor_scope: await protectedServerDigest(`organizer:${user.id}`),
      p_limit: 180,
      p_operation: 'organizer-ticket-summaries',
      p_window_seconds: 600,
    });
    if (rateError) throw databaseApiError(rateError, 'organizer_ticket_summaries_rate_limit');
    if (!(rateLimit as { allowed: boolean }).allowed) {
      throw exposedApiError(429, 'rate_limit_exceeded', 'Too many dashboard refreshes. Try again later.');
    }
    const { data: event, error: eventError } = await userClient
      .from('events')
      .select('event_id, name, description, location, capacity, is_listed, starts_at, ends_at, created_at, updated_at, join_code, event_salt, pk_sign_event, pk_gate_event')
      .eq('event_id', body.event_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return jsonError(req, 404, 'event_not_found', 'Event not found.');

    const [
      { data: tickets, error: ticketError },
      { data: ticketTypes, error: typeError },
      { data: activity, error: activityError },
      { data: organizerActivity, error: organizerActivityError },
      { data: checkins, error: checkinError },
      { data: gate, error: gateError },
      { data: revocations, error: revocationError },
    ] = await Promise.all([
      userClient
        .from('event_tickets')
        .select('id, ticket_type_id, attendee_user_id, status, claim_code_hint, generation_count, current_pass_id, claimed_at, enrolled_at, checked_in_at, cancelled_at, revoked_at, created_at, updated_at')
        .eq('event_id', body.event_id)
        .order('created_at', { ascending: false }),
      userClient
        .from('event_ticket_types')
        .select('id, name, description, price_pence, currency, capacity, is_active, is_default, sort_order, created_at, updated_at')
        .eq('event_id', body.event_id)
        .order('sort_order', { ascending: true }),
      userClient
        .from('ticket_activity_log')
        .select('id, ticket_id, activity_type, from_status, to_status, pass_id, metadata, created_at')
        .eq('event_id', body.event_id)
        .order('created_at', { ascending: false })
        .limit(500),
      userClient
        .from('organizer_activity_log')
        .select('id, actor_user_id, activity_type, resource_type, resource_id, metadata, created_at')
        .eq('event_id', body.event_id)
        .order('created_at', { ascending: false })
        .limit(500),
      userClient
        .from('gate_checkins')
        .select('id, ticket_id, pass_id, decision, gate_timestamp, received_at')
        .eq('event_id', body.event_id)
        .order('received_at', { ascending: false })
        .limit(500),
      userClient
        .from('gate_devices')
        .select('id, device_name, provisioned_at, key_version, last_seen_at, revoked_at')
        .eq('event_id', body.event_id)
        .maybeSingle(),
      userClient
        .from('revocations')
        .select('id, ticket_id, pass_id, reason, revoked_at')
        .eq('event_id', body.event_id)
        .order('revoked_at', { ascending: false }),
    ]);
    const queryError = ticketError ?? typeError ?? activityError ?? organizerActivityError
      ?? checkinError ?? gateError ?? revocationError;
    if (queryError) throw queryError;

    const attendeeIds = [...new Set((tickets ?? []).map((ticket) => ticket.attendee_user_id))];
    const { data: profiles, error: profileError } = attendeeIds.length === 0
      ? { data: [], error: null }
      : await adminClient
        .from('attendee_profiles')
        .select('user_id, email, full_name')
        .in('user_id', attendeeIds);
    if (profileError) throw profileError;

    const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    const typeById = new Map((ticketTypes ?? []).map((ticketType) => [ticketType.id, ticketType]));
    const enrichedTickets = (tickets ?? []).map((ticket) => ({
      ...ticket,
      attendee_email: profileById.get(ticket.attendee_user_id)?.email ?? '',
      attendee_name: profileById.get(ticket.attendee_user_id)?.full_name ?? 'Unknown attendee',
      ticket_type_name: typeById.get(ticket.ticket_type_id)?.name ?? 'Unknown ticket type',
      ticket_type_price_pence: typeById.get(ticket.ticket_type_id)?.price_pence ?? 0,
    }));
    const counts = Object.fromEntries(
      ['claimed', 'enrolled', 'checked_in', 'cancelled', 'revoked'].map((status) => [
        status,
        enrichedTickets.filter((ticket) => ticket.status === status).length,
      ]),
    );

    return jsonSuccess(req, {
      activity: activity ?? [],
      checkins: checkins ?? [],
      counts,
      event,
      gate: gate ?? null,
      organizer_activity: organizerActivity ?? [],
      revocations: revocations ?? [],
      ticket_types: ticketTypes ?? [],
      tickets: enrichedTickets,
    });
  } catch (error) {
    return respondWithError(req, error, {
      code: 'organizer_ticket_summaries_failed',
      message: 'Unable to load organizer ticket summaries.',
    });
  }
});
