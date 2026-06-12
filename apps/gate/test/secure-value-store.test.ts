import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deleteGatePrivateKey,
  deleteGateSyncPrivateKey,
  loadGatePrivateKey,
  loadGateSyncPrivateKey,
  saveGatePrivateKey,
  saveGateSyncPrivateKey,
  type SecureValueStore,
} from '../src/lib/secure-value-store.ts';

function createStore(): SecureValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();

  return {
    values,
    async deleteItem(key) {
      values.delete(key);
    },
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
}

test('stores encryption and sync private keys under separate event-scoped keys', async () => {
  const store = createStore();
  const encryptionKey = Uint8Array.from({ length: 32 }, (_, index) => index);
  const syncKey = Uint8Array.from({ length: 64 }, (_, index) => 255 - index);

  await saveGatePrivateKey(store, 'evt_test', encryptionKey);
  await saveGateSyncPrivateKey(store, 'evt_test', syncKey);

  assert.deepEqual(await loadGatePrivateKey(store, 'evt_test'), encryptionKey);
  assert.deepEqual(await loadGateSyncPrivateKey(store, 'evt_test'), syncKey);
  assert.equal(store.values.size, 2);

  await deleteGatePrivateKey(store, 'evt_test');
  assert.equal(await loadGatePrivateKey(store, 'evt_test'), null);
  assert.deepEqual(await loadGateSyncPrivateKey(store, 'evt_test'), syncKey);

  await deleteGateSyncPrivateKey(store, 'evt_test');
  assert.equal(await loadGateSyncPrivateKey(store, 'evt_test'), null);
});
