import { jsonError, jsonSuccess, readJsonBody, respondWithError } from '../_shared/api.ts';
import { handleCors } from '../_shared/cors.ts';
import { hasEventEnded } from '../_shared/event-lifecycle.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import type { EnrollmentBundleResponse } from '../_shared/types.ts';

const JOIN_CODE_PATTERN = /^[A-Z0-9]{8}$/;

function extractJoinCode(body: { join_code?: string }): string {
  return (body.join_code ?? '').trim().toUpperCase();
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== 'POST') {
    return jsonError(
      405,
      'method_not_allowed',
      'Use POST for get-enrollment-bundle.',
    );
  }

  try {
    const body = await readJsonBody<{ join_code?: string }>(req);
    const joinCode = extractJoinCode(body);

    if (!JOIN_CODE_PATTERN.test(joinCode)) {
      return jsonError(400, 'invalid_join_code', 'join_code must be 8 uppercase alphanumeric characters.');
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('events')
      .select('event_id, event_salt, pk_gate_event, pk_sign_event, starts_at, ends_at')
      .eq('join_code', joinCode)
      .single();

    if (error || !data) {
      return jsonError(404, 'event_not_found', 'No event found for the provided join code.');
    }

    if (hasEventEnded(data)) {
      return jsonError(
        409,
        'event_ended',
        'This event has already ended and cannot accept new attendees.',
      );
    }

    if (!data.pk_gate_event) {
      return jsonError(409, 'gate_not_provisioned', 'This event is not yet provisioned for enrollment.');
    }

    const response: EnrollmentBundleResponse = {
      ends_at: data.ends_at,
      event_id: data.event_id,
      event_salt: data.event_salt,
      pk_gate_event: data.pk_gate_event,
      pk_sign_event: data.pk_sign_event,
      starts_at: data.starts_at,
    };

    return jsonSuccess(response);
  } catch (error) {
    return respondWithError(error, {
      code: 'enrollment_bundle_failed',
      message: 'Unable to load the enrollment bundle.',
      status: 400,
    });
  }
});
