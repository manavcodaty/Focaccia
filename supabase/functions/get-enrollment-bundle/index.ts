import { jsonError, jsonSuccess, readJsonBody } from '../_shared/api.ts';
import { handleCors } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import type { EnrollmentBundleResponse, EventRecord } from '../_shared/types.ts';

const JOIN_CODE_PATTERN = /^[A-Z0-9]{8}$/;

function extractJoinCode(req: Request, body?: { join_code?: string }): string {
  const url = new URL(req.url);
  const candidate = body?.join_code ?? url.searchParams.get('join_code') ?? '';
  return candidate.trim().toUpperCase();
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError(
      405,
      'method_not_allowed',
      'Use GET or POST for get-enrollment-bundle.',
    );
  }

  try {
    const body = req.method === 'POST' ? await readJsonBody<{ join_code?: string }>(req) : undefined;
    const joinCode = extractJoinCode(req, body);

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
    const message = error instanceof Error ? error.message : 'Unknown error.';
    return jsonError(400, 'enrollment_bundle_failed', message);
  }
});
