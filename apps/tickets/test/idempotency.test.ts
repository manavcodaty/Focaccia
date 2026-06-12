import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearIdempotencyKey,
  createUuidV4,
  getOrCreateIdempotencyKey,
  idempotencyStorageKey,
  type KeyStorage,
} from '../lib/idempotency.ts';

test('UUID generation works without the secure-context randomUUID API', () => {
  const uuid = createUuidV4((bytes) => {
    bytes.set(Array.from({ length: 16 }, (_, index) => index));
    return bytes;
  });

  assert.equal(uuid, '00010203-0405-4607-8809-0a0b0c0d0e0f');
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

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
