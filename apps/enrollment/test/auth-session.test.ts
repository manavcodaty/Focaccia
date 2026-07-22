import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import * as authSession from '../src/lib/auth-session.ts';

const { restoreEnrollmentSession } = authSession;

const helperPath = path.resolve(import.meta.dirname, '../src/lib/auth-session.ts');

function storedSession(session: object) {
  return {
    async clear() {},
    async read() {
      return JSON.stringify(session);
    },
    release() {},
  };
}

test('enrollment isolates persisted-session restoration for stale-token recovery', () => {
  assert.equal(
    existsSync(helperPath),
    true,
    'expected a testable persisted-session restoration helper',
  );
});

test('invalid persisted refresh tokens restore as signed out without an auth error', async () => {
  const session = {
    access_token: 'expired-access-token',
    expires_at: 1_699_999_999,
    refresh_token: 'stale-refresh-token',
    user: { id: 'attendee-1' },
  };
  let autoRefreshStarted = false;
  let refreshAttempted = false;

  const result = await restoreEnrollmentSession({
    async getSession() {
      return { data: { session }, error: null };
    },
    async setSession(currentSession) {
      refreshAttempted = true;
      assert.equal(currentSession.refresh_token, session.refresh_token);
      return {
        data: { session: null, user: null },
        error: Object.assign(new Error('Invalid Refresh Token: Refresh Token Not Found'), {
          code: 'refresh_token_not_found',
          name: 'AuthApiError',
          status: 400,
        }),
      };
    },
    async startAutoRefresh() {
      autoRefreshStarted = true;
    },
  }, storedSession(session), 1_700_000_000_000);

  assert.equal(refreshAttempted, true);
  assert.equal(autoRefreshStarted, true);
  assert.deepEqual(result, { error: null, session: null });
});

test('retryable refresh failures preserve the local session for offline recovery', async () => {
  const session = {
    access_token: 'expired-access-token',
    expires_at: 1_699_999_999,
    refresh_token: 'temporarily-unreachable-token',
    user: { id: 'attendee-1' },
  };
  const networkError = Object.assign(new Error('Network request failed'), {
    name: 'AuthRetryableFetchError',
    status: 0,
  });

  const result = await restoreEnrollmentSession({
    async getSession() {
      return { data: { session }, error: null };
    },
    async setSession() {
      return { data: { session: null, user: null }, error: networkError };
    },
    async startAutoRefresh() {},
  }, storedSession(session), 1_700_000_000_000);

  assert.deepEqual(result.session, session);
  assert.equal(result.error, networkError);
});

test('fresh persisted sessions start auto-refresh without an unnecessary request', async () => {
  const session = {
    access_token: 'fresh-access-token',
    expires_at: 1_700_000_600,
    refresh_token: 'fresh-refresh-token',
    user: { id: 'attendee-1' },
  };
  let autoRefreshStarted = false;

  const result = await restoreEnrollmentSession({
    async getSession() {
      return { data: { session }, error: null };
    },
    async setSession() {
      assert.fail('a fresh session must not be refreshed during restoration');
    },
    async startAutoRefresh() {
      autoRefreshStarted = true;
    },
  }, storedSession(session), 1_700_000_000_000);

  assert.equal(autoRefreshStarted, true);
  assert.deepEqual(result, { error: null, session });
});

test('expired persisted sessions refresh while SDK storage reads remain deferred', async () => {
  const session = {
    access_token: 'expired-access-token',
    expires_at: 1_699_999_999,
    refresh_token: 'stale-refresh-token',
    user: { id: 'attendee-1' },
  };
  let storageReleased = false;
  let setSessionCalled = false;

  const result = await restoreEnrollmentSession({
    async getSession() {
      assert.fail('getSession must not see an expired persisted session before explicit recovery');
    },
    async setSession(tokens) {
      setSessionCalled = true;
      assert.equal(storageReleased, false);
      assert.equal(tokens.access_token, session.access_token);
      assert.equal(tokens.refresh_token, session.refresh_token);
      return {
        data: { session: null, user: null },
        error: Object.assign(new Error('Refresh token is not valid'), {
          code: 'validation_failed',
          name: 'AuthApiError',
          status: 400,
        }),
      };
    },
    async startAutoRefresh() {},
  }, {
    async clear() {},
    async read() {
      return JSON.stringify(session);
    },
    release() {
      storageReleased = true;
    },
  }, 1_700_000_000_000);

  assert.equal(setSessionCalled, true);
  assert.equal(storageReleased, true);
  assert.deepEqual(result, { error: null, session: null });
});

test('deferred auth storage hides only the main session until recovery releases it', async () => {
  assert.equal(typeof authSession.createDeferredAuthStorage, 'function');

  const values = new Map([
    ['enrollment-auth', 'persisted-session'],
    ['enrollment-auth-code-verifier', 'verifier'],
  ]);
  const deferred = authSession.createDeferredAuthStorage({
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async removeItem(key) {
      values.delete(key);
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  }, 'enrollment-auth');

  assert.equal(await deferred.storage.getItem('enrollment-auth'), null);
  assert.equal(await deferred.storage.getItem('enrollment-auth-code-verifier'), 'verifier');
  assert.equal(await deferred.read(), 'persisted-session');

  deferred.release();
  assert.equal(await deferred.storage.getItem('enrollment-auth'), 'persisted-session');
});
