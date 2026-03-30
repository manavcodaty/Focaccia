import { createClient } from '@supabase/supabase-js';
import type { GateBundle } from '@face-pass/shared';

import { getSupabasePublicEnv } from './env';
import type { OrganizerAuthState } from './types';

interface ErrorShape {
  code: string;
  message: string;
}

interface ErrorResponse {
  error: ErrorShape;
  ok: false;
}

interface SuccessResponse<T> {
  data: T;
  ok: true;
}

type FunctionResponse<T> = ErrorResponse | SuccessResponse<T>;

export class GateApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, error: ErrorShape) {
    super(error.message);
    this.code = error.code;
    this.status = status;
  }
}

function createGateSupabaseClient(accessToken?: string) {
  const env = getSupabasePublicEnv();
  const options: Parameters<typeof createClient>[2] = {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  return createClient(env.url, env.anonKey, options);
}

async function invokeFunction<T>({
  accessToken,
  body,
  name,
}: {
  accessToken: string;
  body: unknown;
  name: string;
}): Promise<T> {
  const env = getSupabasePublicEnv();
  const response = await fetch(`${env.url}/functions/v1/${name}`, {
    body: JSON.stringify(body),
    headers: {
      apikey: env.anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = (await response.json()) as FunctionResponse<T>;

  if (!response.ok || !payload.ok) {
    const error = payload.ok
      ? { code: 'unknown_error', message: 'Unexpected function response.' }
      : payload.error;

    throw new GateApiError(response.status, error);
  }

  return payload.data;
}

export async function signInOrganizer(
  email: string,
  password: string,
): Promise<OrganizerAuthState> {
  const supabase = createGateSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? 'Unable to sign in.');
  }

  return {
    accessToken: data.session.access_token,
    email: data.user.email ?? email.trim(),
    userId: data.user.id,
  };
}

export async function callProvisionGate(
  auth: OrganizerAuthState,
  request: { device_name?: string; event_id: string; pk_gate_event: string },
): Promise<GateBundle> {
  return invokeFunction<GateBundle>({
    accessToken: auth.accessToken,
    body: request,
    name: 'provision-gate',
  });
}

export async function syncRevocations(
  auth: OrganizerAuthState,
  eventId: string,
): Promise<Array<{ pass_id: string; revoked_at: string }>> {
  const supabase = createGateSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from('revocations')
    .select('pass_id, revoked_at')
    .eq('event_id', eventId)
    .order('revoked_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
