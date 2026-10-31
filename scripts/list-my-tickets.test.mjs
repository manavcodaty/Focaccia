import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../apps/enrollment/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../supabase/functions/list-my-tickets/index.ts', import.meta.url), 'utf8');

async function listTickets(events) {
  const tickets = events.map((event) => ({
    id: `ticket-${event.event_id}`, event_id: event.event_id, ticket_type_id: 'type',
    claim_code_ciphertext: 'protected', status: 'enrolled',
  }));
  let handler;
  let decrypted = 0;
  function query(table) {
    let rows = table === 'events' ? events : table === 'event_tickets' ? tickets : [{ id: 'type', name: 'Admission' }];
    return {
      select() { return this; },
      eq(key, value) { assert.equal(key, 'attendee_user_id'); assert.equal(value, 'owner'); return this; },
      in() { return this; },
      is(key, value) { rows = rows.filter((row) => row[key] === value); return this; },
      order() { return this; },
      limit() { return this; },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
  }
  const modules = {
    '../_shared/api.ts': {
      jsonSuccess: (_req, data) => ({ data }),
      respondWithError: (_req, error) => { throw error; },
    },
    '../_shared/auth.ts': { requireAuthenticated: async () => ({ user: { id: 'owner' }, userClient: { from: query } }) },
    '../_shared/cors.ts': { handleCors: () => null },
    '../_shared/claim-code.ts': { decryptClaimCode: async () => { decrypted++; return 'code'; } },
    '../_shared/schemas.ts': { emptyBodySchema: {} },
    '../_shared/supabase.ts': { createAdminClient: () => ({ from: query }) },
    '../_shared/ticket-response.ts': {
      sanitizeTicketRecord: ({ claim_code_ciphertext, ...ticket }) => ticket,
      recoverTicketClaimCode: (ticket, decrypt) => decrypt(ticket.claim_code_ciphertext),
    },
    '../_shared/validation.ts': { parseJsonBody: async () => ({}) },
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports: {}, Deno: { serve: (fn) => { handler = fn; } }, require: (id) => {
    assert.ok(modules[id], id); return modules[id];
  } });
  const response = await handler({ method: 'POST' });
  return { response: JSON.parse(JSON.stringify(response)), decrypted };
}

test('owned tickets for hidden events are omitted without recovering their claim codes', async () => {
  const { response, decrypted } = await listTickets([{ event_id: 'hidden', deleted_at: '2026-10-31' }]);
  assert.deepEqual(response.data.tickets, []);
  assert.equal(decrypted, 0);
});

test('owned tickets for visible events remain available alongside hidden events', async () => {
  const { response, decrypted } = await listTickets([
    { event_id: 'hidden', deleted_at: '2026-10-31' },
    { event_id: 'visible', deleted_at: null },
  ]);
  assert.deepEqual(response.data.tickets.map((ticket) => ticket.event_id), ['visible']);
  assert.equal(decrypted, 1);
  assert.equal(response.data.tickets[0].status, 'enrolled');
  assert.equal(response.data.tickets[0].claim_code_ciphertext, undefined);
});
