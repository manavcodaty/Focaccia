import { exposedApiError, jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { requireOrganizer } from '../_shared/auth.ts';
import { protectedServerDigest } from '../_shared/claim-code.ts';
import { handleCors } from '../_shared/cors.ts';
import { databaseApiError } from '../_shared/database-errors.ts';
import { buildOrganizerTicketsCsv } from '../_shared/organizer-csv.ts';
import { publicEventSchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for export-organizer-tickets.');

  try {
    const { adminClient, user, userClient } = await requireOrganizer(req);
    const body = await parseJsonBody(req, publicEventSchema);
    const { data: rateLimit, error: rateError } = await adminClient.rpc('consume_api_rate_limit', {
      p_actor_scope: await protectedServerDigest(`organizer:${user.id}`),
      p_limit: 20,
      p_operation: 'export-organizer-tickets',
      p_window_seconds: 600,
    });
    if (rateError) throw databaseApiError(rateError, 'export_organizer_tickets_rate_limit');
    if (!(rateLimit as { allowed: boolean }).allowed) {
      throw exposedApiError(429, 'rate_limit_exceeded', 'Too many ticket exports. Try again later.');
    }
    const { data: event, error: eventError } = await userClient
      .from('events')
      .select('event_id, name')
      .eq('event_id', body.event_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return jsonError(req, 404, 'event_not_found', 'Event not found.');

    const [{ data: tickets, error: ticketError }, { data: ticketTypes, error: typeError }] = await Promise.all([
      userClient
        .from('event_tickets')
        .select('id, ticket_type_id, attendee_user_id, status, generation_count, checked_in_at')
        .eq('event_id', body.event_id)
        .order('created_at', { ascending: true }),
      userClient
        .from('event_ticket_types')
        .select('id, name')
        .eq('event_id', body.event_id),
    ]);
    if (ticketError || typeError) throw ticketError ?? typeError;

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
    const rows = (tickets ?? []).map((ticket) => ({
      attendee_email: profileById.get(ticket.attendee_user_id)?.email ?? '',
      attendee_name: profileById.get(ticket.attendee_user_id)?.full_name ?? 'Unknown attendee',
      checked_in_at: ticket.checked_in_at,
      generation_count: ticket.generation_count,
      status: ticket.status,
      ticket_id: ticket.id,
      ticket_type_name: typeById.get(ticket.ticket_type_id)?.name ?? 'Unknown ticket type',
    }));
    const csv = buildOrganizerTicketsCsv(rows);
    const filename = `${event.event_id}-tickets.csv`;

    const { error: auditError } = await adminClient.from('organizer_activity_log').insert({
      activity_type: 'tickets_exported',
      actor_user_id: user.id,
      event_id: event.event_id,
      metadata: { row_count: rows.length },
      resource_id: filename,
      resource_type: 'export',
    });
    if (auditError) throw auditError;

    return jsonSuccess(req, { csv, filename, row_count: rows.length });
  } catch (error) {
    return respondWithError(req, error, {
      code: 'export_organizer_tickets_failed',
      message: 'Unable to export organizer tickets.',
    });
  }
});
