import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.100.0';

import { getRuntimeConfig } from './env.ts';

function buildClient(key: string, accessToken?: string): SupabaseClient {
  const config = getRuntimeConfig();
  const headers = accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : undefined;

  return createClient(config.supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers,
    },
  });
}

export function createAdminClient(): SupabaseClient {
  return buildClient(getRuntimeConfig().supabaseServiceRoleKey);
}

export function createUserClient(accessToken: string): SupabaseClient {
  return buildClient(getRuntimeConfig().supabaseAnonKey, accessToken);
}

export function getBearerToken(req: Request): string | null {
  const authorization = req.headers.get('Authorization');

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireUser(
  req: Request,
): Promise<{ accessToken: string; user: User; userClient: SupabaseClient }> {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    throw new Error('Missing bearer token.');
  }

  const anonClient = buildClient(getRuntimeConfig().supabaseAnonKey);
  const {
    data: { user },
    error,
  } = await anonClient.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error('Authentication failed.');
  }

  return {
    accessToken,
    user,
    userClient: createUserClient(accessToken),
  };
}
