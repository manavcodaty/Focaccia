import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';
import { toBase64Url, x25519Keypair } from '@face-pass/shared';

import { createTimeoutFetch, fetchWithTimeout, resolveSupabaseUrl } from '../src/lib/network.ts';

function parseEnvFile(filePath: string): Record<string, string> {
  const raw = readFileSync(filePath, 'utf8');
  const values: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    values[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }

  return values;
}

function getLocalIpv4Address(): string | null {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return null;
}

async function expectJson(response: Response): Promise<unknown> {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response, got: ${text}`);
  }
}

async function invokeFunction<T>({
  accessToken,
  anonKey,
  body,
  name,
  supabaseUrl,
}: {
  accessToken: string;
  anonKey: string;
  body: unknown;
  name: string;
  supabaseUrl: string;
}): Promise<T> {
  const response = await fetchWithTimeout({
    errorPrefix: 'Unable to reach the gate provisioning service.',
    init: {
      body: JSON.stringify(body),
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
    input: `${supabaseUrl}/functions/v1/${name}`,
  });
  const payload = (await expectJson(response)) as
    | { data: T; ok: true }
    | { error?: { code?: string; message?: string }; msg?: string; ok?: false };

  if (!response.ok || !payload || !('ok' in payload) || payload.ok !== true) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && payload.error?.message
        ? `${name} failed: ${payload.error.message}`
        : payload && typeof payload === 'object' && 'msg' in payload && typeof payload.msg === 'string'
          ? `${name} failed: ${payload.msg}`
          : `${name} failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload.data;
}

const gateDir = import.meta.dirname;
const gateEnv = parseEnvFile(path.join(gateDir, '../.env.local'));
const webEnv = parseEnvFile(path.join(gateDir, '../../web/.env.local'));
const configuredUrl = gateEnv.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = gateEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

assert.ok(configuredUrl, 'Missing EXPO_PUBLIC_SUPABASE_URL.');
assert.ok(anonKey, 'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY.');

const localIpv4 = getLocalIpv4Address();
const resolvedUrl = resolveSupabaseUrl({
  configuredUrl,
  expoHostUri: localIpv4 ? `${localIpv4}:8081` : null,
});

const supabase = createClient(resolvedUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
  global: {
    fetch: createTimeoutFetch({
      errorPrefix: 'Unable to reach the organizer sign-in service.',
    }),
  },
});

const email = `gate-${randomUUID()}@example.com`;
const password = `P@ssword-${randomUUID()}`;

const signUpResult = await supabase.auth.signUp({ email, password });

if (signUpResult.error) {
  throw signUpResult.error;
}

const signInResult = await supabase.auth.signInWithPassword({ email, password });

if (signInResult.error || !signInResult.data.session || !signInResult.data.user) {
  throw new Error(signInResult.error?.message ?? 'Unable to sign in the organizer.');
}

const accessToken = signInResult.data.session.access_token;
const eventId = `evt_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const endsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

const createdEvent = await invokeFunction<{
  event_id: string;
  join_code: string;
}>({
  accessToken,
  anonKey,
  body: {
    ends_at: endsAt,
    event_id: eventId,
    name: 'Gate Provisioning Verification Event',
    starts_at: startsAt,
  },
  name: 'create-event',
  supabaseUrl: resolvedUrl,
});

const gateKeypair = await x25519Keypair();
const provisionedGate = await invokeFunction<{
  event_id: string;
  k_code_event?: string;
  pk_gate_event: string;
  policy: {
    liveness_timeout_ms: number;
    match_threshold: number;
    queue_code_digits?: number;
    queue_code_enabled: boolean;
    single_entry: boolean;
    typed_token_fallback: boolean;
  };
}>({
  accessToken,
  anonKey,
  body: {
    device_name: 'Gate Verification Device',
    event_id: createdEvent.event_id,
    pk_gate_event: await toBase64Url(gateKeypair.publicKey),
  },
  name: 'provision-gate',
  supabaseUrl: resolvedUrl,
});

assert.equal(provisionedGate.event_id, createdEvent.event_id);
assert.equal(provisionedGate.policy.single_entry, true);
assert.equal(provisionedGate.policy.typed_token_fallback, true);

console.log(
  JSON.stringify(
    {
      event_id: createdEvent.event_id,
      join_code: createdEvent.join_code,
      organizer_email: signInResult.data.user.email,
      provisioned_pk_gate_event: provisionedGate.pk_gate_event,
      resolved_supabase_url: resolvedUrl,
      verified: true,
    },
    null,
    2,
  ),
);
