import assert from 'node:assert/strict';
import test from 'node:test';
import { createObservationRelay } from './lib/cloud-observation-relay.mjs';

test('isolated relay serves health, refuses connections when stopped, and reconnects on the same port', async (t) => {
  const initial = createObservationRelay({ bindHost: '127.0.0.1', bindPort: 0 });
  t.after(() => initial.close());
  const url = await initial.start();
  const proof = await initial.disconnect();
  assert.equal(proof.relay_stop_confirmed, true);
  assert.equal(proof.relay_health_available, false);
  assert.ok(Date.parse(proof.relay_health_available_before_stop_at) <= Date.parse(proof.checked_at));
  await assert.rejects(fetch(url), (error) => error.cause?.code === 'ECONNREFUSED');
  const restored = createObservationRelay({ bindHost: '127.0.0.1', bindPort: Number(new URL(url).port) });
  t.after(() => restored.close());
  assert.equal(await restored.start(), url);
  await restored.disconnect();
  assert.equal(await restored.start(), url);
  assert.equal((await fetch(url)).status, 200);
});

test('an already stopped relay cannot establish a fresh offline-path proof', async (t) => {
  const relay = createObservationRelay({ bindHost: '127.0.0.1', bindPort: 0 });
  t.after(() => relay.close());
  await relay.start();
  await relay.close();
  await assert.rejects(relay.disconnect(), (error) => error.cause?.code === 'ECONNREFUSED');
});
