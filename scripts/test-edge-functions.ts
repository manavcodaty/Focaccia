const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const shared = require('../packages/shared/dist/index.js');

function parseEnvOutput(raw) {
  const values = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || !trimmed.includes('=')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex);
    let value = trimmed.slice(separatorIndex + 1);

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function getSupabaseStatusEnv() {
  const output = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const env = parseEnvOutput(output);

  const requiredKeys = ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'];

  for (const key of requiredKeys) {
    assert.ok(env[key], `supabase status -o env did not return ${key}`);
  }

  return env;
}

async function expectJson(response) {
  const text = await response.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Expected JSON response, got: ${text}`);
  }

  return json;
}

async function invokeFunction(apiUrl, anonKey, name, options = {}) {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has('apikey')) {
    headers.set('apikey', anonKey);
  }

  const response = await fetch(`${apiUrl}/functions/v1/${name}`, {
    ...options,
    headers,
  });
  const json = await expectJson(response);
  return { response, json };
}

async function queryRest(apiUrl, serviceRoleKey, path) {
  const response = await fetch(`${apiUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  const json = await expectJson(response);
  return { response, json };
}

async function signUpOrganizer(apiUrl, anonKey) {
  const email = `organizer-${randomUUID()}@example.com`;
  const password = `P@ssword-${randomUUID()}`;
  const response = await fetch(`${apiUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  const json = await expectJson(response);

  assert.equal(response.status, 200, `sign up failed: ${JSON.stringify(json)}`);
  assert.ok(json.access_token, 'signup response did not include access_token');

  return {
    accessToken: json.access_token,
    email,
    userId: json.user?.id,
  };
}

async function main() {
  const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = getSupabaseStatusEnv();

  const corsResponse = await fetch(`${API_URL}/functions/v1/create-event`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Headers': 'authorization, content-type, apikey',
      'Access-Control-Request-Method': 'POST',
    },
  });

  assert.equal(corsResponse.status, 200, 'preflight request failed');
  assert.equal(corsResponse.headers.get('access-control-allow-origin'), '*');

  const organizer = await signUpOrganizer(API_URL, ANON_KEY);
  const startsAt = new Date(Date.now() + 5 * 60 * 1000);
  const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const eventId = `evt_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  const createEvent = await invokeFunction(API_URL, ANON_KEY, 'create-event', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${organizer.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_id: eventId,
      name: 'Layer 3 Integration Event',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    }),
  });

  assert.equal(createEvent.response.status, 201, JSON.stringify(createEvent.json));
  assert.equal(createEvent.json.ok, true);
  assert.equal(createEvent.json.data.event_id, eventId);
  assert.match(createEvent.json.data.join_code, /^[A-Z0-9]{8}$/);
  assert.match(createEvent.json.data.event_salt, /^[A-Za-z0-9_-]{43}$/);
  assert.match(createEvent.json.data.pk_sign_event, /^[A-Za-z0-9_-]{43}$/);

  const eventsCheck = await queryRest(
    API_URL,
    SERVICE_ROLE_KEY,
    `events?select=event_id,join_code,event_salt,pk_sign_event,pk_gate_event&event_id=eq.${eventId}`,
  );
  assert.equal(eventsCheck.response.status, 200);
  assert.equal(eventsCheck.json.length, 1);
  assert.equal(eventsCheck.json[0].join_code, createEvent.json.data.join_code);

  const secretsCheck = await queryRest(
    API_URL,
    SERVICE_ROLE_KEY,
    `edge_event_secrets?select=event_id,sk_sign_event_ciphertext,k_code_event_ciphertext&event_id=eq.${eventId}`,
  );
  assert.equal(secretsCheck.response.status, 200);
  assert.equal(secretsCheck.json.length, 1);
  assert.match(
    secretsCheck.json[0].sk_sign_event_ciphertext,
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  );

  const gateKeyPair = await shared.x25519Keypair();
  const gatePublicKey = await shared.toBase64Url(gateKeyPair.publicKey);
  const provisionGate = await invokeFunction(API_URL, ANON_KEY, 'provision-gate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${organizer.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_id: eventId,
      device_name: 'Gate Phone 1',
      pk_gate_event: gatePublicKey,
    }),
  });

  assert.equal(provisionGate.response.status, 200, JSON.stringify(provisionGate.json));
  assert.equal(provisionGate.json.ok, true);
  assert.equal(provisionGate.json.data.pk_gate_event, gatePublicKey);
  assert.match(provisionGate.json.data.k_code_event, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(provisionGate.json.data.policy.match_threshold, 80);

  const duplicateProvision = await invokeFunction(API_URL, ANON_KEY, 'provision-gate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${organizer.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_id: eventId,
      device_name: 'Gate Phone 2',
      pk_gate_event: gatePublicKey,
    }),
  });
  assert.equal(duplicateProvision.response.status, 409);

  const gateDevicesCheck = await queryRest(
    API_URL,
    SERVICE_ROLE_KEY,
    `gate_devices?select=event_id,device_name,pk_gate_event&event_id=eq.${eventId}`,
  );
  assert.equal(gateDevicesCheck.response.status, 200);
  assert.equal(gateDevicesCheck.json.length, 1);
  assert.equal(gateDevicesCheck.json[0].pk_gate_event, gatePublicKey);

  const enrollmentBundle = await invokeFunction(
    API_URL,
    ANON_KEY,
    `get-enrollment-bundle?join_code=${createEvent.json.data.join_code}`,
    {
      method: 'GET',
    },
  );
  assert.equal(enrollmentBundle.response.status, 200, JSON.stringify(enrollmentBundle.json));
  assert.equal(enrollmentBundle.json.data.event_id, eventId);
  assert.equal(enrollmentBundle.json.data.pk_gate_event, gatePublicKey);
  assert.equal(enrollmentBundle.json.data.pk_sign_event, createEvent.json.data.pk_sign_event);

  const templateBytes = Uint8Array.from({ length: 32 }, (_, index) => (index * 19 + 7) & 0xff);
  const encTemplateBytes = await shared.x25519Seal(templateBytes, gateKeyPair.publicKey);
  const encTemplate = await shared.toBase64Url(encTemplateBytes);
  const iat = Math.floor(startsAt.getTime() / 1000);
  const exp = Math.floor(endsAt.getTime() / 1000);
  const payload = {
    v: 1,
    event_id: eventId,
    iat,
    exp,
    pass_id: await shared.toBase64Url(Uint8Array.from({ length: 16 }, (_, index) => (index * 11 + 3) & 0xff)),
    nonce: await shared.toBase64Url(Uint8Array.from({ length: 12 }, (_, index) => (index * 5 + 1) & 0xff)),
    enc_template: encTemplate,
    single_use: true,
  };

  const issuePass = await invokeFunction(API_URL, ANON_KEY, 'issue-pass', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payload,
    }),
  });
  assert.equal(issuePass.response.status, 200, JSON.stringify(issuePass.json));
  assert.equal(issuePass.json.ok, true);
  assert.match(issuePass.json.data.signature, /^[A-Za-z0-9_-]+$/);
  assert.match(issuePass.json.data.queue_code, /^[0-9]{8}$/);

  const payloadBytes = shared.canonicalJsonBytes(payload);
  const signatureBytes = await shared.fromBase64Url(issuePass.json.data.signature);
  const publicKeyBytes = await shared.fromBase64Url(createEvent.json.data.pk_sign_event);
  const signatureValid = await shared.ed25519VerifyDetached(
    signatureBytes,
    payloadBytes,
    publicKeyBytes,
  );
  assert.equal(signatureValid, true, 'returned signature did not verify against the payload');

  const revokePass = await invokeFunction(API_URL, ANON_KEY, 'revoke-pass', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${organizer.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_id: eventId,
      pass_id: payload.pass_id,
    }),
  });
  assert.equal(revokePass.response.status, 201, JSON.stringify(revokePass.json));

  const duplicateRevocation = await invokeFunction(API_URL, ANON_KEY, 'revoke-pass', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${organizer.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_id: eventId,
      pass_id: payload.pass_id,
    }),
  });
  assert.equal(duplicateRevocation.response.status, 409);

  const revocationsCheck = await queryRest(
    API_URL,
    SERVICE_ROLE_KEY,
    `revocations?select=event_id,pass_id&event_id=eq.${eventId}&pass_id=eq.${payload.pass_id}`,
  );
  assert.equal(revocationsCheck.response.status, 200);
  assert.equal(revocationsCheck.json.length, 1);

  console.log('Edge function integration passed.');
  console.log(JSON.stringify({
    event_id: eventId,
    join_code: createEvent.json.data.join_code,
    queue_code: issuePass.json.data.queue_code,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
