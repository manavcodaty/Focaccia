import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const shared = require('../packages/shared/dist/index.js');

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf('=');
    if (separator < 1) return [];
    const raw = line.slice(separator + 1).trim();
    return [[line.slice(0, separator), raw.replace(/^"|"$/g, '')]];
  }));
}

function localSupabase() {
  const output = execFileSync('supabase', ['status', '--workdir', '.focaccia/runtime', '-o', 'env'], {
    encoding: 'utf8',
    env: { ...process.env, DOCKER_HOST: process.env.FOCACCIA_DOCKER_HOST ?? 'ssh://colima' },
  });
  const values = parseEnv(output);
  for (const key of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) assert.ok(values[key], `Missing ${key}`);
  return values;
}

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = localSupabase();
const runId = randomUUID().replace(/-/g, '').slice(0, 8);
const defaultSourceIp = `2001:db8:${runId.slice(0, 4)}:${runId.slice(4)}::1`;
const localOrganizerTestPassword = process.env.FOCACCIA_LOCAL_ORGANIZER_TEST_PASSWORD ?? 'FocacciaLocal2026!';

async function jsonResponse(response) {
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${response.url}, received ${text.slice(0, 500)}`);
  }
  assert.match(json.request_id ?? randomUUID(), /^[0-9a-f-]{36}$/);
  return json;
}

async function signUp(email) {
  const password = `P@ssword-${randomUUID()}`;
  const response = await fetch(`${API_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await jsonResponse(response);
  assert.equal(response.status, 200, JSON.stringify(json));
  assert.ok(json.access_token, `Missing access token for ${email}`);
  return { accessToken: json.access_token, email, userId: json.user.id };
}

async function authenticateAllowlisted(email) {
  const password = localOrganizerTestPassword;
  const listResponse = await fetch(`${API_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  const listed = await jsonResponse(listResponse);
  assert.equal(listResponse.status, 200, JSON.stringify(listed));
  const existing = listed.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  const adminResponse = await fetch(
    existing
      ? `${API_URL}/auth/v1/admin/users/${existing.id}`
      : `${API_URL}/auth/v1/admin/users`,
    {
      method: existing ? 'PUT' : 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(existing
        ? { email_confirm: true, password }
        : { email, email_confirm: true, password }),
    },
  );
  const adminJson = await jsonResponse(adminResponse);
  assert.ok(adminResponse.ok, JSON.stringify(adminJson));

  const tokenResponse = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const tokenJson = await jsonResponse(tokenResponse);
  assert.equal(tokenResponse.status, 200, JSON.stringify(tokenJson));
  assert.ok(tokenJson.access_token, `Missing access token for ${email}`);
  return { accessToken: tokenJson.access_token, email, userId: tokenJson.user.id };
}

async function invoke(name, {
  accessToken,
  body = {},
  idempotencyKey,
  rawBody,
  sourceIp = defaultSourceIp,
} = {}) {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken ?? ANON_KEY}`,
    'Content-Type': 'application/json',
    'x-forwarded-for': sourceIp,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${API_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: rawBody ?? JSON.stringify(body),
  });
  return { json: await jsonResponse(response), response };
}

async function adminRows(table, query) {
  const response = await fetch(`${API_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  const json = await jsonResponse(response);
  assert.equal(response.status, 200, JSON.stringify(json));
  return json;
}

async function adminInsert(table, row) {
  const response = await fetch(`${API_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  assert.equal(response.status, 201, await response.text());
}

async function userRows(account, table, query) {
  const response = await fetch(`${API_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${account.accessToken}`,
      Accept: 'application/json',
    },
  });
  const json = await jsonResponse(response);
  assert.equal(response.status, 200, JSON.stringify(json));
  return json;
}

async function ensureOrganizer(account, expectedStatus = 200) {
  const result = await invoke('ensure-organizer', { accessToken: account.accessToken });
  assert.equal(result.response.status, expectedStatus, JSON.stringify(result.json));
  return result.json;
}

async function ensureAttendee(account, fullName) {
  const result = await invoke('ensure-attendee', {
    accessToken: account.accessToken,
    body: { full_name: fullName },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.json));
}

async function createEvent(account, suffix, overrides = {}) {
  const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const result = await invoke('create-event', {
    accessToken: account.accessToken,
    body: {
      capacity: 5,
      description: 'Phase 2 integration event',
      ends_at: endsAt,
      event_id: `evt_phase2_${runId}_${suffix}`,
      is_listed: true,
      location: 'Test Hall',
      name: `Phase 2 ${suffix}`,
      starts_at: startsAt,
      ...overrides,
    },
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.json));
  return result.json.data;
}

async function claim(account, event, ticketTypeId, idempotencyKey = randomUUID()) {
  return invoke('claim-free-ticket', {
    accessToken: account.accessToken,
    body: { event_id: event.event_id, ticket_type_id: ticketTypeId },
    idempotencyKey,
  });
}

function randomBase64Url(length) {
  return shared.toBase64Url(Uint8Array.from({ length }, () => Math.floor(Math.random() * 256)));
}

function passPayload(event, passId, encTemplate) {
  return {
    enc_template: encTemplate,
    event_id: event.event_id,
    exp: Math.floor(new Date(event.ends_at).getTime() / 1000),
    iat: Math.max(Math.floor(Date.now() / 1000), Math.floor(new Date(event.starts_at).getTime() / 1000)),
    nonce: '',
    pass_id: passId,
    single_use: true,
    v: 1,
  };
}

function assertNoClaimSecrets(ticket) {
  assert.ok(!Object.hasOwn(ticket, 'claim_code_ciphertext'));
  assert.ok(!Object.hasOwn(ticket, 'claim_code_digest'));
}

const organizer = await authenticateAllowlisted('organizer@example.com');
const organizerTwo = await authenticateAllowlisted('organizer2@example.com');
const attendees = await Promise.all(Array.from({ length: 6 }, async (_, index) =>
  signUp(`phase2-attendee-${index + 1}-${randomUUID()}@example.com`)));

await ensureOrganizer(organizer);
await ensureOrganizer(organizerTwo);
await ensureOrganizer(attendees[0], 403);
await adminInsert('organizer_profiles', {
  email: attendees[0].email,
  user_id: attendees[0].userId,
});
await Promise.all(attendees.map((account, index) => ensureAttendee(account, `Attendee ${index + 1}`)));

const attendeeCreate = await invoke('create-event', {
  accessToken: attendees[0].accessToken,
  body: {
    capacity: 1,
    description: '',
    ends_at: new Date(Date.now() + 60_000).toISOString(),
    event_id: 'evt_attendee_forbidden',
    is_listed: true,
    location: '',
    name: 'Forbidden',
    starts_at: new Date().toISOString(),
  },
});
assert.equal(attendeeCreate.response.status, 403);

const mainEvent = await createEvent(organizer, 'main');
const privateEvent = await createEvent(organizer, 'private', { is_listed: false });
const otherOrganizerEvent = await createEvent(organizerTwo, 'other');

const foreignSummary = await invoke('organizer-ticket-summaries', {
  accessToken: organizer.accessToken,
  body: { event_id: otherOrganizerEvent.event_id },
});
assert.equal(foreignSummary.response.status, 404);

const publicEvents = await invoke('get-public-events', {
  body: {
    cursor: new Date(new Date(mainEvent.starts_at).getTime() - 1).toISOString(),
    limit: 50,
  },
});
assert.equal(publicEvents.response.status, 200, JSON.stringify(publicEvents.json));
const publicIds = publicEvents.json.data.events.map((event) => event.event_id);
assert.ok(publicIds.includes(mainEvent.event_id));
assert.ok(!publicIds.includes(privateEvent.event_id));

const paidType = await invoke('manage-ticket-type', {
  accessToken: organizer.accessToken,
  body: {
    capacity: 5,
    description: 'Visible but unavailable',
    event_id: mainEvent.event_id,
    is_active: true,
    name: 'Paid Reserved',
    price_pence: 2500,
    sort_order: 10,
    ticket_type_id: null,
  },
});
assert.equal(paidType.response.status, 201, JSON.stringify(paidType.json));
const paidClaim = await claim(attendees[0], mainEvent, paidType.json.data.id);
assert.equal(paidClaim.response.status, 409);
assert.equal(paidClaim.json.error.code, 'paid_ticket_unavailable');

const checkoutKey = randomUUID();
const firstClaim = await claim(attendees[0], mainEvent, mainEvent.ticket_type.id, checkoutKey);
assert.equal(firstClaim.response.status, 201, JSON.stringify(firstClaim.json));
assertNoClaimSecrets(firstClaim.json.data.ticket);
assert.match(firstClaim.json.data.claim_code, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){2}$/);
const replayClaim = await claim(attendees[0], mainEvent, mainEvent.ticket_type.id, checkoutKey);
assert.equal(replayClaim.response.status, 200, JSON.stringify(replayClaim.json));
assert.equal(replayClaim.json.data.ticket.id, firstClaim.json.data.ticket.id);
assert.equal(replayClaim.json.data.claim_code, firstClaim.json.data.claim_code);
const conflictingReplay = await claim(attendees[0], mainEvent, paidType.json.data.id, checkoutKey);
assert.equal(conflictingReplay.response.status, 409, JSON.stringify(conflictingReplay.json));
assert.equal(conflictingReplay.json.error.code, 'idempotency_conflict');
const additionalClaims = await Promise.all(
  Array.from({ length: 3 }, () => claim(attendees[0], mainEvent, mainEvent.ticket_type.id)),
);
assert.deepEqual(additionalClaims.map((result) => result.response.status), [201, 201, 201]);
const overLimitClaim = await claim(attendees[0], mainEvent, mainEvent.ticket_type.id);
assert.equal(overLimitClaim.response.status, 409);
assert.equal(overLimitClaim.json.error.code, 'ticket_limit_reached');

const isolatedList = await invoke('list-my-tickets', { accessToken: attendees[1].accessToken });
assert.equal(isolatedList.response.status, 200);
assert.equal(isolatedList.json.data.tickets.length, 0);

const organizerEvents = await userRows(organizer, 'events', 'select=event_id,created_by');
assert.ok(organizerEvents.every((event) => event.created_by === organizer.userId));
assert.ok(!organizerEvents.some((event) => event.event_id === otherOrganizerEvent.event_id));
const organizerTwoEvents = await userRows(organizerTwo, 'events', 'select=event_id,created_by');
assert.ok(organizerTwoEvents.every((event) => event.created_by === organizerTwo.userId));
const attendeeEvents = await userRows(attendees[0], 'events', 'select=event_id');
assert.equal(attendeeEvents.length, 0);
const attendeeTickets = await userRows(attendees[0], 'event_tickets', 'select=id,attendee_user_id');
assert.equal(attendeeTickets.length, 4);
assert.ok(attendeeTickets.some((ticket) => ticket.id === firstClaim.json.data.ticket.id));
assert.ok(attendeeTickets.every((ticket) => ticket.attendee_user_id === attendees[0].userId));

const finalSeatEvent = await createEvent(organizer, 'final_seat', { capacity: 1 });
const finalSeatResults = await Promise.all([
  claim(attendees[1], finalSeatEvent, finalSeatEvent.ticket_type.id),
  claim(attendees[2], finalSeatEvent, finalSeatEvent.ticket_type.id),
]);
assert.deepEqual(finalSeatResults.map((result) => result.response.status).sort(), [201, 409]);
assert.ok(['event_sold_out', 'ticket_type_sold_out'].includes(
  finalSeatResults.find((result) => result.response.status === 409).json.error.code,
));

const cancellationEvent = await createEvent(organizer, 'cancel');
const cancellationClaim = await claim(attendees[3], cancellationEvent, cancellationEvent.ticket_type.id);
assert.equal(cancellationClaim.response.status, 201);
const cancellation = await invoke('cancel-ticket', {
  accessToken: attendees[3].accessToken,
  body: { ticket_id: cancellationClaim.json.data.ticket.id },
  idempotencyKey: randomUUID(),
});
assert.equal(cancellation.response.status, 200, JSON.stringify(cancellation.json));
assertNoClaimSecrets(cancellation.json.data.ticket);
assert.equal(cancellation.json.data.ticket.status, 'cancelled');

const gateEncryptionKeys = await shared.x25519Keypair();
const gateSyncKeys = await shared.ed25519Keypair();
const provision = await invoke('provision-gate', {
  accessToken: organizer.accessToken,
  body: {
    device_name: 'Phase 2 Gate',
    event_id: mainEvent.event_id,
    pk_gate_event: await shared.toBase64Url(gateEncryptionKeys.publicKey),
    sync_public_key: await shared.toBase64Url(gateSyncKeys.publicKey),
  },
});
assert.equal(provision.response.status, 200, JSON.stringify(provision.json));

const ownedBundle = await invoke('get-enrollment-bundle', {
  accessToken: attendees[0].accessToken,
  body: { ticket_id: firstClaim.json.data.ticket.id },
});
assert.equal(ownedBundle.response.status, 200, JSON.stringify(ownedBundle.json));
const codeBundle = await invoke('get-enrollment-bundle', {
  accessToken: attendees[0].accessToken,
  body: { claim_code: firstClaim.json.data.claim_code },
});
assert.equal(codeBundle.response.status, 200, JSON.stringify(codeBundle.json));
const foreignCode = await invoke('get-enrollment-bundle', {
  accessToken: attendees[1].accessToken,
  body: { claim_code: firstClaim.json.data.claim_code },
});
assert.equal(foreignCode.response.status, 404);
assert.equal(foreignCode.json.error.code, 'ticket_not_found');
const invalidCode = await invoke('get-enrollment-bundle', {
  accessToken: attendees[0].accessToken,
  body: { claim_code: 'INVALID-CODE' },
});
assert.equal(invalidCode.response.status, 404);
assert.equal(invalidCode.json.error.code, 'ticket_not_found');

const encryptedTemplate = await shared.toBase64Url(
  await shared.x25519Seal(Uint8Array.from({ length: 32 }, (_, index) => index), gateEncryptionKeys.publicKey),
);
async function issueGeneration() {
  const payload = passPayload(mainEvent, await randomBase64Url(16), encryptedTemplate);
  payload.nonce = await randomBase64Url(12);
  const idempotencyKey = randomUUID();
  const result = await invoke('issue-pass', {
    accessToken: attendees[0].accessToken,
    body: { payload, ticket_id: firstClaim.json.data.ticket.id },
    idempotencyKey,
  });
  return { idempotencyKey, payload, result };
}

const generationOne = await issueGeneration();
assert.equal(generationOne.result.response.status, 201, JSON.stringify(generationOne.result.json));
assert.equal(generationOne.result.json.data.generation, 1);
const generationOneReplay = await invoke('issue-pass', {
  accessToken: attendees[0].accessToken,
  body: { payload: generationOne.payload, ticket_id: firstClaim.json.data.ticket.id },
  idempotencyKey: generationOne.idempotencyKey,
});
assert.equal(generationOneReplay.response.status, 200, JSON.stringify(generationOneReplay.json));
assert.equal(generationOneReplay.json.data.generation, 1);
const generationTwo = await issueGeneration();
assert.equal(generationTwo.result.json.data.generation, 2);
const generationThree = await issueGeneration();
assert.equal(generationThree.result.json.data.generation, 3);
const generationFour = await issueGeneration();
assert.equal(generationFour.result.response.status, 409);
assert.equal(generationFour.result.json.error.code, 'pass_generation_limit');

const passesBeforeReset = await adminRows(
  'event_passes',
  `select=pass_id,generation,status&ticket_id=eq.${firstClaim.json.data.ticket.id}&order=generation.asc`,
);
assert.deepEqual(passesBeforeReset.map((pass) => pass.status), ['revoked', 'revoked', 'active']);
assert.ok(passesBeforeReset.every((pass) => !('enc_template' in pass) && !('pass_token' in pass)));

const reset = await invoke('reset-attendee-pass', {
  accessToken: organizer.accessToken,
  body: { ticket_id: firstClaim.json.data.ticket.id },
  idempotencyKey: randomUUID(),
});
assert.equal(reset.response.status, 200, JSON.stringify(reset.json));
assertNoClaimSecrets(reset.json.data.ticket);
assert.equal(reset.json.data.ticket.status, 'claimed');
assert.equal(reset.json.data.ticket.generation_count, 0);
assert.equal(reset.json.data.ticket.current_pass_id, null);

const postResetGeneration = await issueGeneration();
assert.equal(postResetGeneration.result.response.status, 201, JSON.stringify(postResetGeneration.result.json));
assert.equal(postResetGeneration.result.json.data.generation, 1);

const gatePayload = {
  decision: 'ACCEPT',
  event_id: mainEvent.event_id,
  gate_timestamp: new Date(Date.now() - 1_000).toISOString(),
  idempotency_key: randomUUID(),
  nonce: await randomBase64Url(16),
  pass_id: postResetGeneration.payload.pass_id,
};
async function signedGateRequest(payload, privateKey = gateSyncKeys.privateKey) {
  return {
    ...payload,
    signature: await shared.toBase64Url(await shared.canonicalJsonSignature(payload, privateKey)),
  };
}

const signedCheckin = await signedGateRequest(gatePayload);

const gateRevocationPayload = {
  event_id: mainEvent.event_id,
  gate_timestamp: new Date().toISOString(),
  idempotency_key: randomUUID(),
  key_version: provision.json.data.key_version,
  nonce: await randomBase64Url(16),
};
const signedRevocationRequest = await signedGateRequest(gateRevocationPayload);
const initialRevocations = await invoke('get-gate-revocations', { body: signedRevocationRequest });
assert.equal(initialRevocations.response.status, 200, JSON.stringify(initialRevocations.json));
assert.equal(initialRevocations.json.data.key_version, provision.json.data.key_version);
assert.ok(Array.isArray(initialRevocations.json.data.revocations));
assert.ok(initialRevocations.json.data.revocations.length >= 3);
for (const row of initialRevocations.json.data.revocations) {
  assert.deepEqual(Object.keys(row).sort(), ['pass_id', 'revoked_at']);
}
const revocationReplay = await invoke('get-gate-revocations', { body: signedRevocationRequest });
assert.equal(revocationReplay.response.status, 200, JSON.stringify(revocationReplay.json));
assert.equal(revocationReplay.json.data.idempotent_replay, true);
const tamperedRevocation = await invoke('get-gate-revocations', {
  body: { ...signedRevocationRequest, key_version: provision.json.data.key_version + 1 },
});
assert.equal(tamperedRevocation.response.status, 403);
assert.equal(tamperedRevocation.json.error.code, 'unknown_gate_key');
const staleRevocationPayload = {
  ...gateRevocationPayload,
  gate_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  idempotency_key: randomUUID(),
  nonce: await randomBase64Url(16),
};
const staleRevocations = await invoke('get-gate-revocations', {
  body: await signedGateRequest(staleRevocationPayload),
});
assert.equal(staleRevocations.response.status, 409);
assert.equal(staleRevocations.json.error.code, 'stale_gate_timestamp');

const checkin = await invoke('record-gate-checkin', { body: signedCheckin });
assert.equal(checkin.response.status, 201, JSON.stringify(checkin.json));
const checkinReplay = await invoke('record-gate-checkin', { body: signedCheckin });
assert.equal(checkinReplay.response.status, 200, JSON.stringify(checkinReplay.json));

const tampered = { ...signedCheckin, pass_id: await randomBase64Url(16) };
const tamperedResult = await invoke('record-gate-checkin', { body: tampered });
assert.equal(tamperedResult.response.status, 403);
assert.equal(tamperedResult.json.error.code, 'invalid_gate_signature');

const nonceReplayPayload = { ...gatePayload, idempotency_key: randomUUID() };
const nonceReplay = await invoke('record-gate-checkin', { body: await signedGateRequest(nonceReplayPayload) });
assert.equal(nonceReplay.response.status, 409);
assert.equal(nonceReplay.json.error.code, 'gate_nonce_replay');

const stalePayload = {
  ...gatePayload,
  gate_timestamp: new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString(),
  idempotency_key: randomUUID(),
  nonce: await randomBase64Url(16),
};
const stale = await invoke('record-gate-checkin', { body: await signedGateRequest(stalePayload) });
assert.equal(stale.response.status, 409);
assert.equal(stale.json.error.code, 'stale_gate_timestamp');

const unknownEventPayload = {
  ...gatePayload,
  event_id: 'evt_unknown_gate',
  idempotency_key: randomUUID(),
  nonce: await randomBase64Url(16),
};
const unknownGate = await invoke('record-gate-checkin', { body: await signedGateRequest(unknownEventPayload) });
assert.equal(unknownGate.response.status, 403);
assert.equal(unknownGate.json.error.code, 'unknown_gate_key');

const revocationEvent = await createEvent(organizer, 'revoke');
const revocationEncryptionKeys = await shared.x25519Keypair();
const revocationSyncKeys = await shared.ed25519Keypair();
const revocationProvision = await invoke('provision-gate', {
  accessToken: organizer.accessToken,
  body: {
    event_id: revocationEvent.event_id,
    pk_gate_event: await shared.toBase64Url(revocationEncryptionKeys.publicKey),
    sync_public_key: await shared.toBase64Url(revocationSyncKeys.publicKey),
  },
});
assert.equal(revocationProvision.response.status, 200);
const revocationClaim = await claim(attendees[4], revocationEvent, revocationEvent.ticket_type.id);
assert.equal(revocationClaim.response.status, 201);
const revocationEncryptedTemplate = await shared.toBase64Url(
  await shared.x25519Seal(Uint8Array.from({ length: 32 }, (_, index) => 31 - index), revocationEncryptionKeys.publicKey),
);
const revocationPayload = passPayload(revocationEvent, await randomBase64Url(16), revocationEncryptedTemplate);
revocationPayload.nonce = await randomBase64Url(12);
const revocationIssue = await invoke('issue-pass', {
  accessToken: attendees[4].accessToken,
  body: { payload: revocationPayload, ticket_id: revocationClaim.json.data.ticket.id },
  idempotencyKey: randomUUID(),
});
assert.equal(revocationIssue.response.status, 201, JSON.stringify(revocationIssue.json));
const revoke = await invoke('revoke-ticket', {
  accessToken: organizer.accessToken,
  body: { reason: 'Security test', ticket_id: revocationClaim.json.data.ticket.id },
  idempotencyKey: randomUUID(),
});
assert.equal(revoke.response.status, 200, JSON.stringify(revoke.json));
assertNoClaimSecrets(revoke.json.data.ticket);
assert.equal(revoke.json.data.ticket.status, 'revoked');
const revocationSnapshotPayload = {
  event_id: revocationEvent.event_id,
  gate_timestamp: new Date(Date.now() - 1_000).toISOString(),
  idempotency_key: randomUUID(),
  key_version: revocationProvision.json.data.key_version,
  nonce: await randomBase64Url(16),
};
const revocationSnapshot = await invoke('get-gate-revocations', {
  body: await signedGateRequest(revocationSnapshotPayload, revocationSyncKeys.privateKey),
});
assert.equal(revocationSnapshot.response.status, 200, JSON.stringify(revocationSnapshot.json));
assert.equal(revocationSnapshot.json.data.revocations.length, 1);
assert.equal(revocationSnapshot.json.data.revocations[0].pass_id, revocationPayload.pass_id);
const revocations = await adminRows(
  'revocations',
  `select=event_id,pass_id,ticket_id&ticket_id=eq.${revocationClaim.json.data.ticket.id}`,
);
assert.equal(revocations.length, 1);

const finalSummary = await invoke('organizer-ticket-summaries', {
  accessToken: organizer.accessToken,
  body: { event_id: mainEvent.event_id },
});
assert.equal(finalSummary.response.status, 200, JSON.stringify(finalSummary.json));
assert.equal(finalSummary.json.data.counts.checked_in, 1);
assert.equal(finalSummary.json.data.checkins.length, 1);

const rateLimitIp = `2001:db8:${runId.slice(0, 4)}:${runId.slice(4)}::2`;
for (let attempt = 1; attempt <= 10; attempt += 1) {
  const invalidLookup = await invoke('get-enrollment-bundle', {
    accessToken: attendees[5].accessToken,
    body: { claim_code: 'INVALID-CODE' },
    sourceIp: rateLimitIp,
  });
  assert.equal(invalidLookup.response.status, 404, JSON.stringify(invalidLookup.json));
}
const userRateLimited = await invoke('get-enrollment-bundle', {
  accessToken: attendees[5].accessToken,
  body: { claim_code: 'INVALID-CODE' },
  sourceIp: `2001:db8:${runId.slice(0, 4)}:${runId.slice(4)}::3`,
});
assert.equal(userRateLimited.response.status, 429, JSON.stringify(userRateLimited.json));
const ipRateLimited = await invoke('get-enrollment-bundle', {
  accessToken: attendees[4].accessToken,
  body: { claim_code: 'INVALID-CODE' },
  sourceIp: rateLimitIp,
});
assert.equal(ipRateLimited.response.status, 429, JSON.stringify(ipRateLimited.json));

gateEncryptionKeys.privateKey.fill(0);
gateSyncKeys.privateKey.fill(0);
revocationEncryptionKeys.privateKey.fill(0);
revocationSyncKeys.privateKey.fill(0);

console.log('Phase 2 end-to-end integration passed.');
