import assert from 'node:assert/strict';
import test from 'node:test';

import { createPassVault, type SecureKeyValueStore } from '../src/lib/pass-vault.ts';
import type { PendingPassIssuance, StoredEnrollmentPass } from '../src/lib/ticket-state.ts';

class MemorySecureStore implements SecureKeyValueStore {
  readonly values = new Map<string, string>();

  async deleteItem(key: string) {
    this.values.delete(key);
  }

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const userA = '30000000-0000-4000-8000-000000000001';
const userB = '30000000-0000-4000-8000-000000000002';
const ticketId = '10000000-0000-4000-8000-000000000001';

function storedPass(): StoredEnrollmentPass {
  return {
    createdAtIso: '2026-06-13T10:05:00.000Z',
    event: {
      ends_at: '2026-06-14T22:00:00.000Z',
      event_id: 'summer-market',
      location: 'Assembly Hall',
      name: 'Summer Market',
      starts_at: '2026-06-14T18:00:00.000Z',
    },
    generation: 1,
    passId: 'abcdefghijklmnopqrstuv',
    ticketId,
    ticketTypeName: 'General Admission',
    token: 'payload.signature',
    tokenSnippet: 'payload...signature',
    userId: userA,
  };
}

function pending(): PendingPassIssuance {
  return {
    createdAtIso: '2026-06-13T10:04:00.000Z',
    idempotencyKey: '40000000-0000-4000-8000-000000000001',
    payload: {
      enc_template: 'a'.repeat(96),
      event_id: 'summer-market',
      exp: 1781474400,
      iat: 1781456400,
      nonce: 'abcdefghijklmnop',
      pass_id: 'abcdefghijklmnopqrstuv',
      single_use: true,
      v: 1,
    },
    ticketId,
    userId: userA,
  };
}

test('stores passes per authenticated user and never exposes one account to another', async () => {
  const store = new MemorySecureStore();
  const vault = createPassVault(store);

  await vault.savePass(storedPass());

  assert.deepEqual(await vault.loadPass(userA, ticketId), storedPass());
  assert.equal(await vault.loadPass(userB, ticketId), null);
  assert.deepEqual(await vault.listPasses(userA), [storedPass()]);
  assert.deepEqual(await vault.listPasses(userB), []);
});

test('keeps a pending idempotent issuance until completion and then clears it', async () => {
  const store = new MemorySecureStore();
  const vault = createPassVault(store);

  await vault.savePending(pending());
  assert.deepEqual(await vault.loadPending(userA, ticketId), pending());

  await vault.removePending(userA, ticketId);
  assert.equal(await vault.loadPending(userA, ticketId), null);
});

test('prepared-device cleanup removes only the active attendee secure records', async () => {
  const store = new MemorySecureStore();
  const vault = createPassVault(store);
  await vault.savePass(storedPass());
  await vault.savePending(pending());
  await vault.savePass({ ...storedPass(), ticketId: '10000000-0000-4000-8000-000000000002', userId: userB });

  await vault.clearUser(userA);

  assert.deepEqual(await vault.listPasses(userA), []);
  assert.equal(await vault.loadPending(userA, ticketId), null);
  assert.equal((await vault.listPasses(userB)).length, 1);
});
