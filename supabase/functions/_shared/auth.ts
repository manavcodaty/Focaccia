import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2.100.0';

import { exposedApiError } from './api.ts';
import { getRuntimeConfig } from './env.ts';
import { createAdminClient, requireUser } from './supabase.ts';

export interface AuthenticatedContext {
  readonly accessToken: string;
  readonly adminClient: SupabaseClient;
  readonly user: User;
  readonly userClient: SupabaseClient;
}

export async function requireAuthenticated(req: Request): Promise<AuthenticatedContext> {
  const context = await requireUser(req);
  return { ...context, adminClient: createAdminClient() };
}

export async function requireOrganizer(req: Request): Promise<AuthenticatedContext> {
  const context = await requireAuthenticated(req);

  if (!isOrganizerAllowlisted(context.user)) {
    throw exposedApiError(403, 'organizer_required', 'Organizer access is required.');
  }

  const { data, error } = await context.adminClient
    .from('organizer_profiles')
    .select('user_id')
    .eq('user_id', context.user.id)
    .maybeSingle();

  if (error || !data) {
    throw exposedApiError(403, 'organizer_required', 'Organizer access is required.');
  }

  return context;
}

export function normalizedAuthenticatedEmail(user: User): string {
  const email = user.email?.trim().toLowerCase();

  if (!email) {
    throw exposedApiError(403, 'verified_email_required', 'A verified email address is required.');
  }

  return email;
}

export function isOrganizerAllowlisted(user: User): boolean {
  return getRuntimeConfig().organizerEmailAllowlist.includes(normalizedAuthenticatedEmail(user));
}
