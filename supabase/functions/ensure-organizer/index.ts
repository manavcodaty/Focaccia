import { jsonError, jsonSuccess, respondWithError } from '../_shared/api.ts';
import { isOrganizerAllowlisted, normalizedAuthenticatedEmail, requireAuthenticated } from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { emptyBodySchema } from '../_shared/schemas.ts';
import { parseJsonBody } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return jsonError(req, 405, 'method_not_allowed', 'Use POST for ensure-organizer.');

  try {
    await parseJsonBody(req, emptyBodySchema);
    const { adminClient, user } = await requireAuthenticated(req);
    if (!isOrganizerAllowlisted(user)) {
      return jsonError(req, 403, 'organizer_not_allowed', 'This account is not permitted to organize events.');
    }

    const email = normalizedAuthenticatedEmail(user);
    const { data, error } = await adminClient
      .from('organizer_profiles')
      .upsert({ email, user_id: user.id }, { onConflict: 'user_id' })
      .select('user_id, email, created_at, updated_at')
      .single();

    if (error || !data) throw error ?? new Error('Organizer profile was not returned.');
    return jsonSuccess(req, data);
  } catch (error) {
    return respondWithError(req, error, {
      code: 'ensure_organizer_failed',
      message: 'Unable to verify organizer access.',
    });
  }
});
