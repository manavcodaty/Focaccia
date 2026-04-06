import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchWithTimeout,
  resolveSupabaseUrl,
} from '../src/lib/network.ts';

test('replaces a stale local LAN host with the current Expo host for the gate app', () => {
  const resolved = resolveSupabaseUrl({
    configuredUrl: 'http://192.168.0.144:54321',
    expoHostUri: '192.168.0.141:8081',
  });

  assert.equal(resolved, 'http://192.168.0.141:54321');
});

test('preserves configured non-local hosts for the gate app', () => {
  const resolved = resolveSupabaseUrl({
    configuredUrl: 'https://project-ref.supabase.co',
    expoHostUri: '192.168.0.141:8081',
  });

  assert.equal(resolved, 'https://project-ref.supabase.co');
});

test('replaces localhost with the current Expo host for gate device builds', () => {
  const resolved = resolveSupabaseUrl({
    configuredUrl: 'http://127.0.0.1:54321',
    expoHostUri: '192.168.0.141:8081',
  });

  assert.equal(resolved, 'http://192.168.0.141:54321');
});

test('times out hung gate requests with an actionable error', async () => {
  await assert.rejects(
    () =>
      fetchWithTimeout({
        errorPrefix: 'Unable to reach the organizer sign-in service.',
        fetchImpl: (_input, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
        input: 'http://192.168.0.144:54321/auth/v1/token?grant_type=password',
        timeoutMs: 10,
      }),
    /Unable to reach the organizer sign-in service\..*EXPO_PUBLIC_SUPABASE_URL/i,
  );
});
