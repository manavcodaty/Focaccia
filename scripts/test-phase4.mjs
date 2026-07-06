import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf('=');
    if (separator < 1) return [];
    return [[line.slice(0, separator), line.slice(separator + 1).trim().replace(/^"|"$/g, '')]];
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
const runId = randomUUID().replaceAll('-', '').slice(0, 8);
const localOrganizerTestPassword = process.env.FOCACCIA_LOCAL_ORGANIZER_TEST_PASSWORD ?? 'FocacciaLocal2026!';

async function jsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${response.url}, received ${text.slice(0, 500)}`);
  }
}

async function authenticateAllowlisted(email) {
  const password = localOrganizerTestPassword;
  const usersResponse = await fetch(`${API_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  const users = await jsonResponse(usersResponse);
  const existing = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  const adminResponse = await fetch(existing ? `${API_URL}/auth/v1/admin/users/${existing.id}` : `${API_URL}/auth/v1/admin/users`, {
    body: JSON.stringify(existing ? { email_confirm: true, password } : { email, email_confirm: true, password }),
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    method: existing ? 'PUT' : 'POST',
  });
  assert.ok(adminResponse.ok, JSON.stringify(await jsonResponse(adminResponse)));
  const tokenResponse = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify({ email, password }),
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const token = await jsonResponse(tokenResponse);
  assert.equal(tokenResponse.status, 200, JSON.stringify(token));
  return { accessToken: token.access_token, userId: token.user.id };
}

async function signUp(email) {
  const response = await fetch(`${API_URL}/auth/v1/signup`, {
    body: JSON.stringify({ email, password: `P@ssword-${randomUUID()}` }),
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const json = await jsonResponse(response);
  assert.equal(response.status, 200, JSON.stringify(json));
  return { accessToken: json.access_token, userId: json.user.id };
}

async function invoke(name, { accessToken, body = {}, idempotencyKey } = {}) {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken ?? ANON_KEY}`,
    'Content-Type': 'application/json',
    'x-forwarded-for': `2001:db8:${runId.slice(0, 4)}:${runId.slice(4)}::4`,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${API_URL}/functions/v1/${name}`, {
    body: JSON.stringify(body),
    headers,
    method: 'POST',
  });
  return { json: await jsonResponse(response), response };
}

async function adminRows(table, query) {
  const response = await fetch(`${API_URL}/rest/v1/${table}?${query}`, {
    headers: { Accept: 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  const json = await jsonResponse(response);
  assert.equal(response.status, 200, JSON.stringify(json));
  return json;
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

const organizer = await authenticateAllowlisted('organizer@example.com');
const otherOrganizer = await authenticateAllowlisted('organizer2@example.com');
for (const account of [organizer, otherOrganizer]) {
  const ensured = await invoke('ensure-organizer', { accessToken: account.accessToken });
  assert.equal(ensured.response.status, 200, JSON.stringify(ensured.json));
}

const startsAt = new Date(Date.now() - 60_000).toISOString();
const endsAt = new Date(Date.now() + 86_400_000).toISOString();
const eventId = `evt_phase4_${runId}`;
const created = await invoke('create-event', {
  accessToken: organizer.accessToken,
  body: {
    capacity: 4,
    description: 'Original event description',
    ends_at: endsAt,
    event_id: eventId,
    is_listed: false,
    location: 'Original Hall',
    name: 'Phase 4 Organizer Event',
    starts_at: startsAt,
  },
});
assert.equal(created.response.status, 201, JSON.stringify(created.json));
assert.equal(created.json.data.ticket_type.name, 'General Admission');
assert.equal(created.json.data.ticket_type.price_pence, 0);
assert.equal(created.json.data.ticket_type.capacity, 4);

const updateBody = {
  capacity: 6,
  description: 'Updated public description',
  ends_at: endsAt,
  event_id: eventId,
  is_listed: true,
  location: 'Steep Courtyard',
  name: 'Phase 4 Updated Event',
  starts_at: startsAt,
};
const updated = await invoke('update-event', { accessToken: organizer.accessToken, body: updateBody });
assert.equal(updated.response.status, 200, JSON.stringify(updated.json));
assert.equal(updated.json.data.capacity, 6);
assert.equal(updated.json.data.location, 'Steep Courtyard');

const publicListed = await invoke('get-public-event', { body: { event_id: eventId } });
assert.equal(publicListed.response.status, 200, JSON.stringify(publicListed.json));
assert.equal(publicListed.json.data.event.name, 'Phase 4 Updated Event');

const foreignUpdate = await invoke('update-event', { accessToken: otherOrganizer.accessToken, body: updateBody });
assert.equal(foreignUpdate.response.status, 403, JSON.stringify(foreignUpdate.json));
const foreignSummary = await invoke('organizer-ticket-summaries', { accessToken: otherOrganizer.accessToken, body: { event_id: eventId } });
assert.equal(foreignSummary.response.status, 404, JSON.stringify(foreignSummary.json));

const freeType = await invoke('manage-ticket-type', {
  accessToken: organizer.accessToken,
  body: { capacity: 2, description: 'Front table', event_id: eventId, is_active: true, name: 'Chef table', price_pence: 0, sort_order: 1, ticket_type_id: null },
});
assert.equal(freeType.response.status, 201, JSON.stringify(freeType.json));
const paidType = await invoke('manage-ticket-type', {
  accessToken: organizer.accessToken,
  body: { capacity: null, description: 'Visible but blocked', event_id: eventId, is_active: true, name: 'Paid supper', price_pence: 2800, sort_order: 2, ticket_type_id: null },
});
assert.equal(paidType.response.status, 201, JSON.stringify(paidType.json));

const attendee = await signUp(`phase4-attendee-${runId}@example.com`);
const attendeeTwo = await signUp(`phase4-attendee-two-${runId}@example.com`);
for (const [account, fullName] of [[attendee, 'Avery Morgan'], [attendeeTwo, 'Imani Patel']]) {
  const profile = await invoke('ensure-attendee', { accessToken: account.accessToken, body: { full_name: fullName } });
  assert.equal(profile.response.status, 200, JSON.stringify(profile.json));
}

const claim = await invoke('claim-free-ticket', {
  accessToken: attendee.accessToken,
  body: { event_id: eventId, ticket_type_id: freeType.json.data.id },
  idempotencyKey: randomUUID(),
});
assert.equal(claim.response.status, 201, JSON.stringify(claim.json));
const paidClaim = await invoke('claim-free-ticket', {
  accessToken: attendeeTwo.accessToken,
  body: { event_id: eventId, ticket_type_id: paidType.json.data.id },
  idempotencyKey: randomUUID(),
});
assert.equal(paidClaim.response.status, 409, JSON.stringify(paidClaim.json));
assert.equal(paidClaim.json.error.code, 'paid_ticket_unavailable');

const provisioned = await invoke('provision-gate', {
  accessToken: organizer.accessToken,
  body: { device_name: 'Phase 4 Gate', event_id: eventId, pk_gate_event: base64Url(randomBytes(32)), sync_public_key: base64Url(randomBytes(32)) },
});
assert.equal(provisioned.response.status, 200, JSON.stringify(provisioned.json));

const passId = base64Url(randomBytes(16));
const issued = await invoke('issue-pass', {
  accessToken: attendee.accessToken,
  body: {
    payload: {
      enc_template: base64Url(randomBytes(96)),
      event_id: eventId,
      exp: Math.floor(new Date(endsAt).getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      nonce: base64Url(randomBytes(16)),
      pass_id: passId,
      single_use: true,
      v: 1,
    },
    ticket_id: claim.json.data.ticket.id,
  },
  idempotencyKey: randomUUID(),
});
assert.equal(issued.response.status, 201, JSON.stringify(issued.json));

const reset = await invoke('reset-attendee-pass', {
  accessToken: organizer.accessToken,
  body: { ticket_id: claim.json.data.ticket.id },
  idempotencyKey: randomUUID(),
});
assert.equal(reset.response.status, 200, JSON.stringify(reset.json));
assert.equal(reset.json.data.ticket.status, 'claimed');
assert.equal(reset.json.data.ticket.generation_count, 0);
assert.equal(reset.json.data.ticket.current_pass_id, null);

const revoked = await invoke('revoke-ticket', {
  accessToken: organizer.accessToken,
  body: { reason: 'Order placed in error', ticket_id: claim.json.data.ticket.id },
  idempotencyKey: randomUUID(),
});
assert.equal(revoked.response.status, 200, JSON.stringify(revoked.json));
assert.equal(revoked.json.data.ticket.status, 'revoked');

const summary = await invoke('organizer-ticket-summaries', { accessToken: organizer.accessToken, body: { event_id: eventId } });
assert.equal(summary.response.status, 200, JSON.stringify(summary.json));
assert.equal(summary.json.data.counts.revoked, 1);
assert.equal(summary.json.data.tickets[0].attendee_name, 'Avery Morgan');
assert.equal(summary.json.data.tickets[0].ticket_type_name, 'Chef table');
assert.ok(summary.json.data.gate);
assert.equal(summary.json.data.ticket_types.length, 3);

const exported = await invoke('export-organizer-tickets', { accessToken: organizer.accessToken, body: { event_id: eventId } });
assert.equal(exported.response.status, 200, JSON.stringify(exported.json));
assert.equal(exported.json.data.row_count, 1);
assert.match(exported.json.data.csv, /Avery Morgan/);
for (const forbidden of ['biometric', 'access_token', 'claim_code_digest', 'claim_code_ciphertext', 'claim code hint', 'pass id', 'private_key', 'auth credential']) {
  assert.ok(!exported.json.data.csv.toLowerCase().includes(forbidden), `CSV leaked ${forbidden}`);
}

const audit = await adminRows('organizer_activity_log', `select=activity_type,resource_type,resource_id&event_id=eq.${eventId}`);
const auditTypes = audit.map((entry) => entry.activity_type);
for (const required of ['event_created', 'event_updated', 'ticket_type_created', 'ticket_reset', 'ticket_revoked', 'gate_provisioned', 'tickets_exported']) {
  assert.ok(auditTypes.includes(required), `Missing organizer audit activity ${required}`);
}

const hidden = await invoke('update-event', { accessToken: organizer.accessToken, body: { ...updateBody, is_listed: false } });
assert.equal(hidden.response.status, 200, JSON.stringify(hidden.json));
const publicHidden = await invoke('get-public-event', { body: { event_id: eventId } });
assert.equal(publicHidden.response.status, 404, JSON.stringify(publicHidden.json));

console.log('Phase 4 organizer dashboard integration passed.');
