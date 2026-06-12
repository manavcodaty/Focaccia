import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearIdempotencyKey,
  getOrCreateIdempotencyKey,
  idempotencyStorageKey,
  type KeyStorage,
} from '../lib/idempotency.ts';

function memoryStorage(): KeyStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
    values,
  };
}

test('checkout retries reuse the same UUID until success clears it', () => {
  const storage = memoryStorage();
  const first = getOrCreateIdempotencyKey(storage, 'checkout', 'evt:type', () => 'uuid-one');
  const retry = getOrCreateIdempotencyKey(storage, 'checkout', 'evt:type', () => 'uuid-two');
  assert.equal(first, 'uuid-one');
  assert.equal(retry, 'uuid-one');
  assert.equal(idempotencyStorageKey('checkout', 'evt:type'), 'focaccia:idempotency:checkout:evt:type');

  clearIdempotencyKey(storage, 'checkout', 'evt:type');
  assert.equal(storage.values.size, 0);
  assert.equal(getOrCreateIdempotencyKey(storage, 'checkout', 'evt:type', () => 'uuid-three'), 'uuid-three');
});
