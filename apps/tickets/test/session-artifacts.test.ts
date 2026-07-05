import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { clearFocacciaSessionArtifacts } from '../lib/session-artifacts.ts';

function memoryStorage(values: string[]): Pick<Storage, 'key' | 'length' | 'removeItem'> & { values: string[] } {
  return {
    get length() {
      return values.length;
    },
    key(index) {
      return values[index] ?? null;
    },
    removeItem(key) {
      const index = values.indexOf(key);
      if (index >= 0) values.splice(index, 1);
    },
    values,
  };
}

test('sign-out cleanup removes Focaccia ticket and idempotency session artifacts only', () => {
  const storage = memoryStorage([
    'focaccia:ticket:ticket-a',
    'focaccia:idempotency:checkout:event-a',
    'unrelated:key',
  ]);

  clearFocacciaSessionArtifacts(storage);

  assert.deepEqual(storage.values, ['unrelated:key']);
});

test('ticket detail never falls back to stale cached tickets after ownership lookup misses', async () => {
  const detailPage = await readFile(new URL('../components/ticket-detail-page.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(detailPage, /sessionStorage\.getItem\(`focaccia:ticket:/);
  assert.match(detailPage, /setTicket\(found\)/);
});

test('tickets app emits baseline browser security headers', async () => {
  const config = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');

  for (const required of [
    'poweredByHeader: false',
    'headers()',
    'Content-Security-Policy',
    "frame-ancestors 'none'",
    'X-Content-Type-Options',
    'Referrer-Policy',
    'X-Frame-Options',
    'Permissions-Policy',
  ]) {
    assert.match(config, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
