import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

import {
  canonicalJsonBytes,
  ed25519VerifyDetached,
  fromBase64Url,
  toBase64Url,
  x25519Keypair,
  x25519SealOpen,
  resolveLocalSupabaseUrl,
  type EnrollmentBundle,
  type IssuePassResult,
  type PassPayload,
} from '@face-pass/shared';

import { issueSignedPassFromEmbedding } from '../src/lib/pass-flow.ts';

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

function createFakeEmbedding(): Float32Array {
  return Float32Array.from({ length: 128 }, (_, index) => {
    const angle = (index + 1) * 0.173;
    return Math.sin(angle) * 0.7 + Math.cos(angle * 0.37) * 0.3;
  });
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

interface FunctionSuccess<T> {
  data: T;
  ok: true;
}

interface FunctionFailure {
  error: {
    code: string;
    message: string;
  };
  ok: false;
  msg?: string;
}

async function callFunction<T>({
  accessToken,
  anonKey,
  body,
  name,
  supabaseUrl,
}: {
  accessToken?: string;
  anonKey: string;
  body?: unknown;
  name: string;
  supabaseUrl: string;
}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken ?? anonKey}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers,
    method: 'POST',
  });
  const payload = (await response.json()) as FunctionSuccess<T> | FunctionFailure;

  if (!response.ok || !payload.ok) {
    const message = payload.ok
      ? `Unexpected failure calling ${name}.`
      : "error" in payload && payload.error
        ? `${name} failed: ${payload.error.code} ${payload.error.message}`
        : `${name} failed: ${"msg" in payload && payload.msg ? payload.msg : JSON.stringify(payload)}`;

    throw new Error(
      message,
    );
  }

  return payload.data;
}

const enrollmentDir = import.meta.dirname;
const env = parseEnvFile(path.join(enrollmentDir, '../../web/.env.local'));
const localIpv4 = getLocalIpv4Address();
const supabaseUrl = resolveLocalSupabaseUrl({
  configuredUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  expoHostUri: localIpv4 ? `${localIpv4}:8081` : null,
});
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

assert.ok(supabaseUrl, 'Missing NEXT_PUBLIC_SUPABASE_URL.');
assert.ok(anonKey, 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.');

const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const email = `enrollment-${randomUUID()}@example.com`;
const password = `P@ssword-${randomUUID()}`;

let authResult = await supabase.auth.signUp({ email, password });

if (authResult.error) {
  throw authResult.error;
}

let session = authResult.data.session;

if (!session) {
  authResult = await supabase.auth.signInWithPassword({ email, password });

  if (authResult.error) {
    throw authResult.error;
  }

  session = authResult.data.session;
}

assert.ok(session?.access_token, 'Organizer session is required for verification.');

const eventId = `evt_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const endsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

const createdEvent = await callFunction<{
  ends_at: string;
  event_id: string;
  event_salt: string;
  join_code: string;
  pk_sign_event: string;
  starts_at: string;
}>({
  accessToken: session.access_token,
  anonKey,
  body: {
    ends_at: endsAt,
    event_id: eventId,
    name: 'Enrollment Verification Event',
    starts_at: startsAt,
  },
  name: 'create-event',
  supabaseUrl,
});

const gateKeys = await x25519Keypair();

await callFunction({
  accessToken: session.access_token,
  anonKey,
  body: {
    device_name: 'Enrollment Verification Gate',
    event_id: createdEvent.event_id,
    pk_gate_event: await toBase64Url(gateKeys.publicKey),
  },
  name: 'provision-gate',
  supabaseUrl,
});

const bundle = await callFunction<EnrollmentBundle>({
  anonKey,
  body: {
    join_code: createdEvent.join_code,
  },
  name: 'get-enrollment-bundle',
  supabaseUrl,
});

const signedPass = await issueSignedPassFromEmbedding({
  bundle,
  embedding: createFakeEmbedding(),
  issuePass: async (payload: PassPayload): Promise<IssuePassResult> =>
    callFunction<IssuePassResult>({
      anonKey,
      body: {
        join_code: createdEvent.join_code,
        payload,
      },
      name: 'issue-pass',
      supabaseUrl,
    }),
  now: new Date(),
});

const [payloadB64, signatureB64] = signedPass.token.split('.');

assert.ok(payloadB64, 'Missing payload segment in token.');
assert.ok(signatureB64, 'Missing signature segment in token.');

const payloadBytes = await fromBase64Url(payloadB64);
const signatureBytes = await fromBase64Url(signatureB64);
const parsedPayload = JSON.parse(new TextDecoder().decode(payloadBytes)) as PassPayload;
const verified = await ed25519VerifyDetached(
  signatureBytes,
  canonicalJsonBytes(parsedPayload as unknown as Record<string, string | number | boolean>),
  await fromBase64Url(bundle.pk_sign_event),
);

assert.equal(verified, true, 'Issued pass signature must verify.');

const decryptedTemplate = await x25519SealOpen(
  await fromBase64Url(parsedPayload.enc_template),
  gateKeys.publicKey,
  gateKeys.privateKey,
);

assert.deepEqual(Array.from(decryptedTemplate), Array.from(signedPass.template));

console.log(
  JSON.stringify(
    {
      event_id: createdEvent.event_id,
      join_code: createdEvent.join_code,
      queue_code: signedPass.queueCode ?? null,
      token_preview: `${payloadB64.slice(0, 16)}...${signatureB64.slice(-16)}`,
      verified: true,
    },
    null,
    2,
  ),
);
