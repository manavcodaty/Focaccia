import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ed25519Keypair,
  ed25519VerifyDetached,
  fromBase64Url,
  prepareCrypto,
} from '@face-pass/shared';

import {
  cacheFreshness,
  canonicalCheckinBytes,
  canonicalRevocationRequestBytes,
  createSignedCheckin,
  createSignedRevocationRequest,
  formatCacheAge,
  nextRetryDelayMs,
  syncFailureDisposition,
} from '../src/lib/gate-sync.ts';

await prepareCrypto();

test('creates canonical check-in and revocation signatures without sensitive fields', async () => {
  const keys = await ed25519Keypair();
  const random = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
  const gateTimestamp = '2026-06-14T08:30:00.000Z';
  const idempotencyKey = '123e4567-e89b-42d3-a456-426614174000';

  try {
    const checkin = await createSignedCheckin({
      eventId: 'evt_gate',
      gateTimestamp,
      idempotencyKey,
      nonceBytes: random,
      passId: 'AQIDBAUGBwgJCgsMDQ4PEA',
      privateKey: keys.privateKey,
    });
    const revocations = await createSignedRevocationRequest({
      eventId: 'evt_gate',
      gateTimestamp,
      idempotencyKey,
      keyVersion: 3,
      nonceBytes: random,
      privateKey: keys.privateKey,
    });

    assert.deepEqual(Object.keys(checkin).sort(), [
      'decision',
      'event_id',
      'gate_timestamp',
      'idempotency_key',
      'nonce',
      'pass_id',
      'signature',
    ]);
    assert.deepEqual(Object.keys(revocations).sort(), [
      'event_id',
      'gate_timestamp',
      'idempotency_key',
      'key_version',
      'nonce',
      'signature',
    ]);

    const checkinSignature = await fromBase64Url(checkin.signature);
    const revocationSignature = await fromBase64Url(revocations.signature);
    assert.equal(
      await ed25519VerifyDetached(checkinSignature, canonicalCheckinBytes(checkin), keys.publicKey),
      true,
    );
    assert.equal(
      await ed25519VerifyDetached(
        revocationSignature,
        canonicalRevocationRequestBytes(revocations),
        keys.publicKey,
      ),
      true,
    );
    assert.equal(
      await ed25519VerifyDetached(
        checkinSignature,
        canonicalCheckinBytes({ ...checkin, pass_id: 'ERITFBUWFxgZGhscHR4fIA' }),
        keys.publicKey,
      ),
      false,
    );
  } finally {
    keys.privateKey.fill(0);
    keys.publicKey.fill(0);
  }
});

test('generates UUID and nonce identities when callers do not provide them', async () => {
  const keys = await ed25519Keypair();
  try {
    const signed = await createSignedCheckin({
      eventId: 'evt_gate',
      gateTimestamp: '2026-06-14T08:30:00.000Z',
      passId: 'AQIDBAUGBwgJCgsMDQ4PEA',
      privateKey: keys.privateKey,
    });
    assert.match(signed.idempotency_key, /^[0-9a-f-]{36}$/);
    assert.match(signed.nonce, /^[A-Za-z0-9_-]{22}$/);
  } finally {
    keys.privateKey.fill(0);
    keys.publicKey.fill(0);
  }
});

test('uses bounded retry delays and distinguishes permanent failures', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 12].map((attempt) => nextRetryDelayMs(attempt, 0)),
    [5_000, 15_000, 60_000, 300_000, 900_000, 900_000, 900_000],
  );
  assert.equal(syncFailureDisposition({ code: 'network_error', status: 0 }), 'retry');
  assert.equal(syncFailureDisposition({ code: 'rate_limited', status: 429 }), 'retry');
  assert.equal(syncFailureDisposition({ code: 'server_error', status: 503 }), 'retry');
  assert.equal(syncFailureDisposition({ code: 'invalid_gate_signature', status: 403 }), 'blocked');
  assert.equal(syncFailureDisposition({ code: 'stale_gate_timestamp', status: 409 }), 'blocked');
  assert.equal(nextRetryDelayMs(-10, -2), 4_000);
  assert.equal(nextRetryDelayMs(50, 2), 1_080_000);
});

test('reports fresh, stale, and critical revocation cache states', () => {
  const now = Date.parse('2026-06-14T09:00:00.000Z');

  assert.deepEqual(cacheFreshness(null, now), { ageMs: null, state: 'critical' });
  assert.deepEqual(cacheFreshness('2026-06-14T08:56:00.000Z', now), {
    ageMs: 240_000,
    state: 'fresh',
  });
  assert.deepEqual(cacheFreshness('2026-06-14T08:50:00.000Z', now), {
    ageMs: 600_000,
    state: 'stale',
  });
  assert.deepEqual(cacheFreshness('2026-06-14T08:20:00.000Z', now), {
    ageMs: 2_400_000,
    state: 'critical',
  });
  assert.deepEqual(cacheFreshness('not-a-date', now), { ageMs: null, state: 'critical' });
  assert.equal(formatCacheAge(null), 'Never refreshed');
  assert.equal(formatCacheAge(30_000), 'Less than 1 minute old');
  assert.equal(formatCacheAge(60_000), '1 minute old');
  assert.equal(formatCacheAge(120_000), '2 minutes old');
});
