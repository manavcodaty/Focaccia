import { createClient } from '@supabase/supabase-js';
import type { GateBundle } from '@face-pass/shared';

import { getSupabasePublicEnv } from './env';
import { createTimeoutFetch, fetchWithTimeout } from './network';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuccessResponse<T>(payload: unknown): payload is SuccessResponse<T> {
  return Boolean(
    payload
      && typeof payload === 'object'
      && 'ok' in payload
      && payload.ok === true
      && 'data' in payload,
  );
}

export class GateApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, error?: ErrorShape, fallbackMessage?: string) {
    super(error?.message ?? fallbackMessage ?? `Gate request failed with status ${status}.`);
    this.code = error?.code ?? 'unknown_error';
    this.status = status;
  }
}

function extractErrorShape(
  payload: unknown,
  status: number,
  statusText?: string,
): ErrorShape {
  if (isRecord(payload) && isRecord(payload.error)) {
    const candidate = payload.error;

    return {
      code: typeof candidate.code === 'string' ? candidate.code : 'unknown_error',
      message:
        typeof candidate.message === 'string' && candidate.message.length > 0
          ? candidate.message
          : statusText || `Gate request failed with status ${status}.`,
    };
  }

  if (isRecord(payload) && typeof payload.msg === 'string') {
    return {
      code: 'unknown_error',
      message: payload.msg,
    };
  }

  if (isRecord(payload) && typeof payload.message === 'string') {
    return {
      code: 'unknown_error',
      message: payload.message,
    };
  }

  return {
    code: 'unknown_error',
    message: statusText || `Gate request failed with status ${status}.`,
  };
}

function createGateSupabaseClient({
  accessToken,
  errorPrefix,
}: {
  accessToken?: string;
  errorPrefix: string;
}) {
  const env = getSupabasePublicEnv();
  const options: Parameters<typeof createClient>[2] = {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: createTimeoutFetch({ errorPrefix }),
    },
  };

  if (accessToken) {
    options.global = {
      ...options.global,
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
  const response = await fetchWithTimeout({
    errorPrefix: 'Unable to reach the gate provisioning service.',
    init: {
      body: JSON.stringify(body),
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
    input: `${env.url}/functions/v1/${name}`,
  });
  const rawBody = await response.text();
  let payload: FunctionResponse<T> | Record<string, unknown> | null = null;

  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody) as FunctionResponse<T> | Record<string, unknown>;
    } catch {
      if (!response.ok) {
        throw new GateApiError(response.status, undefined, rawBody);
      }

      throw new Error('Function response was not valid JSON.');
    }
  }

  if (
    !response.ok
    || !isSuccessResponse<T>(payload)
  ) {
    throw new GateApiError(
      response.status,
      extractErrorShape(payload, response.status, response.statusText),
    );
  }

  return payload.data;
}

export async function signInOrganizer(
  email: string,
  password: string,
): Promise<OrganizerAuthState> {
  const supabase = createGateSupabaseClient({
    errorPrefix: 'Unable to reach the organizer sign-in service.',
  });
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
  const supabase = createGateSupabaseClient({
    accessToken: auth.accessToken,
    errorPrefix: 'Unable to reach the organizer sync service.',
  });
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
