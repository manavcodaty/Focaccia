import assert from 'node:assert/strict';
import test from 'node:test';
import {publicSnapshot} from './lib/cloud-gate-evidence.mjs';

test('public snapshot retains queue timing and gate fingerprint without working signature material',()=>{
  const gate={event_id:'event',gate_device_id:'device',sync_public_key:Buffer.alloc(32,1).toString('base64url'),last_revocation_sync_at:'2026-11-17T12:00:00Z'};
  const queue=[{event_id:'event',pass_id:'pass',decision:'ACCEPT',gate_timestamp:'2026-11-17T12:01:00Z',status:'pending',attempt_count:0,signature:'synthetic-signature',nonce:'synthetic-nonce',idempotency_key:'synthetic-idempotency'}];
  const snapshot=publicSnapshot(gate,queue,[],'2026-11-17T12:01:01Z');
  assert.equal(snapshot.gate_key_fingerprint.length,64);assert.equal(snapshot.queue[0].gate_timestamp,queue[0].gate_timestamp);
  for(const key of ['signature','nonce','idempotency_key'])assert.equal(Object.hasOwn(snapshot.queue[0],key),false);
});
test('missing public gate identity fails evidence capture',()=>assert.throws(()=>publicSnapshot({},[],[],'2026-11-17T12:00:00Z'),/identity/));
