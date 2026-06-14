import assert from 'node:assert/strict';
import test from 'node:test';

import { createIdempotencyKey, formatUuidV4 } from '../src/lib/idempotency-key.ts';

test('formats exactly sixteen random bytes as an RFC 4122 UUID v4', () => {
  const value = formatUuidV4(Uint8Array.from({ length: 16 }, (_, index) => index));

  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(value, '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('creates a UUID using the provided cryptographic random source', async () => {
  let requestedLength = 0;
  const value = await createIdempotencyKey(async (length) => {
    requestedLength = length;
    return new Uint8Array(length).fill(255);
  });

  assert.equal(requestedLength, 16);
  assert.equal(value, 'ffffffff-ffff-4fff-bfff-ffffffffffff');
});

test('rejects byte arrays that are not UUID-sized', () => {
  assert.throws(() => formatUuidV4(new Uint8Array(15)), /16 bytes/i);
});
