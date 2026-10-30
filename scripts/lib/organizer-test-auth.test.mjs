import assert from 'node:assert/strict';
import test from 'node:test';

import { authenticateTestOrganizer } from './organizer-test-auth.mjs';

test('authenticates integration organizers without setting or replacing a password', async () => {
  const calls = [];
  const result = await authenticateTestOrganizer({
    apiUrl: 'http://127.0.0.1:54321',
    anonKey: 'test-anon',
    serviceRoleKey: 'test-admin',
    email: 'organizer@example.com',
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: JSON.parse(options.body) });
      return Response.json(calls.length === 1
        ? { hashed_token: 'test-hash' }
        : { access_token: 'test-session', user: { id: 'test-user' } });
    },
  });
  assert.deepEqual(result, {
    accessToken: 'test-session', email: 'organizer@example.com', userId: 'test-user',
  });
  assert.equal(calls[0].url, 'http://127.0.0.1:54321/auth/v1/admin/generate_link');
  assert.deepEqual(calls[0].body, { type: 'magiclink', email: 'organizer@example.com' });
  assert.equal(calls[1].url, 'http://127.0.0.1:54321/auth/v1/verify');
  assert.deepEqual(calls[1].body, { type: 'magiclink', token_hash: 'test-hash' });
  assert.equal(calls[1].headers.apikey, 'test-anon');
  assert.equal(calls[1].headers.Authorization, undefined);
});

test('stops on an auth error without including sensitive response bodies', async () => {
  await assert.rejects(authenticateTestOrganizer({
    apiUrl: 'http://127.0.0.1:54321', anonKey: 'test-anon', serviceRoleKey: 'test-admin',
    email: 'organizer@example.com',
    fetch: async () => Response.json({ message: 'sensitive detail' }, { status: 403 }),
  }), { message: 'Organizer test auth generate_link failed (403).' });
});
