import assert from 'node:assert/strict';
import test from 'node:test';

import { createEnrollmentApi } from '../src/lib/api.ts';

const env = {
  anonKey: 'anon-key',
  diagnosticLabel: 'Local network' as const,
  localHost: '192.168.1.20',
  mode: 'local' as const,
  supabaseUrl: 'http://192.168.1.20:54331',
  ticketsUrl: 'http://192.168.1.20:3001',
  url: 'http://192.168.1.20:54331',
  webUrl: 'http://192.168.1.20:3000',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, ok: status < 400 }), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

test('lists the authenticated attendee tickets without putting identity in the body', async () => {
  const requests: Array<{ body: string | null; headers: Headers; url: string }> = [];
  const api = createEnrollmentApi({
    fetchImpl: async (input, init) => {
      requests.push({
        body: typeof init?.body === 'string' ? init.body : null,
        headers: new Headers(init?.headers),
        url: String(input),
      });
      return jsonResponse({ meta: { next_cursor: null }, tickets: [] });
    },
    getAccessToken: async () => 'attendee-token',
    getEnvironment: () => env,
  });

  assert.deepEqual(await api.listMyTickets(), { meta: { next_cursor: null }, tickets: [] });
  assert.equal(requests[0]?.url, `${env.url}/functions/v1/list-my-tickets`);
  assert.equal(requests[0]?.headers.get('authorization'), 'Bearer attendee-token');
  assert.equal(requests[0]?.headers.get('apikey'), 'anon-key');
  assert.equal(requests[0]?.body, '{}');
});

test('normalizes an owned claim code and keeps ownership server-derived', async () => {
  let body: string | null = null;
  const api = createEnrollmentApi({
    fetchImpl: async (_input, init) => {
      body = typeof init?.body === 'string' ? init.body : null;
      return jsonResponse({ event: {}, ticket: {} });
    },
    getAccessToken: async () => 'attendee-token',
    getEnvironment: () => env,
  });

  await api.getEnrollmentBundle({ claimCode: ' abcd-efgh-jklm ' });
  assert.deepEqual(JSON.parse(body!), { claim_code: 'ABCD-EFGH-JKLM' });
  assert.doesNotMatch(body!, /attendee|user_id|email/i);
});

test('issues a pass with ticket binding and a UUID idempotency header', async () => {
  let request: { body: string; headers: Headers } | null = null;
  const api = createEnrollmentApi({
    fetchImpl: async (_input, init) => {
      request = {
        body: String(init?.body),
        headers: new Headers(init?.headers),
      };
      return jsonResponse({
        generation: 1,
        idempotent_replay: false,
        signature: 'signed',
      }, 201);
    },
    getAccessToken: async () => 'attendee-token',
    getEnvironment: () => env,
  });
  const payload = {
    enc_template: 'a'.repeat(96),
    event_id: 'summer-market',
    exp: 1781474400,
    iat: 1781456400,
    nonce: 'abcdefghijklmnop',
    pass_id: 'abcdefghijklmnopqrstuv',
    single_use: true as const,
    v: 1 as const,
  };

  await api.issuePass({
    idempotencyKey: '40000000-0000-4000-8000-000000000001',
    payload,
    ticketId: '10000000-0000-4000-8000-000000000001',
  });

  assert.equal(
    request!.headers.get('idempotency-key'),
    '40000000-0000-4000-8000-000000000001',
  );
  assert.deepEqual(JSON.parse(request!.body), {
    payload,
    ticket_id: '10000000-0000-4000-8000-000000000001',
  });
});

test('fails before a request when the secure session is absent', async () => {
  let requested = false;
  const api = createEnrollmentApi({
    fetchImpl: async () => {
      requested = true;
      return jsonResponse({});
    },
    getAccessToken: async () => null,
    getEnvironment: () => env,
  });

  await assert.rejects(() => api.listMyTickets(), /sign in/i);
  assert.equal(requested, false);
});
