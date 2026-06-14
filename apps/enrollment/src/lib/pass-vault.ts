import type { PendingPassIssuance, StoredEnrollmentPass } from './ticket-state';

export interface SecureKeyValueStore {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const passIndexPrefix = 'focaccia.pass-index.v1';
const passPrefix = 'focaccia.pass.v1';
const pendingIndexPrefix = 'focaccia.pending-index.v1';
const pendingPrefix = 'focaccia.pending.v1';

function recordKey(prefix: string, userId: string, ticketId: string): string {
  return `${prefix}.${userId}.${ticketId}`;
}

function indexKey(prefix: string, userId: string): string {
  return `${prefix}.${userId}`;
}

function parseRecord<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null ? parsed as T : null;
  } catch {
    return null;
  }
}

async function loadIndex(
  storage: SecureKeyValueStore,
  prefix: string,
  userId: string,
): Promise<string[]> {
  const parsed = parseRecord<unknown>(await storage.getItem(indexKey(prefix, userId)));
  return Array.isArray(parsed)
    ? parsed.filter((value): value is string => typeof value === 'string')
    : [];
}

async function addToIndex(
  storage: SecureKeyValueStore,
  prefix: string,
  userId: string,
  ticketId: string,
): Promise<void> {
  const current = await loadIndex(storage, prefix, userId);
  const next = current.includes(ticketId) ? current : [...current, ticketId];
  await storage.setItem(indexKey(prefix, userId), JSON.stringify(next));
}

async function removeFromIndex(
  storage: SecureKeyValueStore,
  prefix: string,
  userId: string,
  ticketId: string,
): Promise<void> {
  const next = (await loadIndex(storage, prefix, userId)).filter((id) => id !== ticketId);
  if (next.length === 0) {
    await storage.deleteItem(indexKey(prefix, userId));
    return;
  }
  await storage.setItem(indexKey(prefix, userId), JSON.stringify(next));
}

export function createPassVault(storage: SecureKeyValueStore) {
  async function loadPass(userId: string, ticketId: string): Promise<StoredEnrollmentPass | null> {
    const pass = parseRecord<StoredEnrollmentPass>(
      await storage.getItem(recordKey(passPrefix, userId, ticketId)),
    );
    return pass?.userId === userId && pass.ticketId === ticketId ? pass : null;
  }

  return {
    async clearUser(userId: string): Promise<void> {
      const [passIds, pendingIds] = await Promise.all([
        loadIndex(storage, passIndexPrefix, userId),
        loadIndex(storage, pendingIndexPrefix, userId),
      ]);
      await Promise.all([
        ...passIds.map((ticketId) => storage.deleteItem(recordKey(passPrefix, userId, ticketId))),
        ...pendingIds.map((ticketId) => storage.deleteItem(recordKey(pendingPrefix, userId, ticketId))),
        storage.deleteItem(indexKey(passIndexPrefix, userId)),
        storage.deleteItem(indexKey(pendingIndexPrefix, userId)),
      ]);
    },

    async listPasses(userId: string): Promise<StoredEnrollmentPass[]> {
      const ticketIds = await loadIndex(storage, passIndexPrefix, userId);
      const passes = await Promise.all(ticketIds.map((ticketId) => loadPass(userId, ticketId)));
      return passes.filter((pass): pass is StoredEnrollmentPass => pass !== null);
    },

    loadPass,

    async loadPending(userId: string, ticketId: string): Promise<PendingPassIssuance | null> {
      const pending = parseRecord<PendingPassIssuance>(
        await storage.getItem(recordKey(pendingPrefix, userId, ticketId)),
      );
      return pending?.userId === userId && pending.ticketId === ticketId ? pending : null;
    },

    async removePass(userId: string, ticketId: string): Promise<void> {
      await Promise.all([
        storage.deleteItem(recordKey(passPrefix, userId, ticketId)),
        removeFromIndex(storage, passIndexPrefix, userId, ticketId),
      ]);
    },

    async removePending(userId: string, ticketId: string): Promise<void> {
      await Promise.all([
        storage.deleteItem(recordKey(pendingPrefix, userId, ticketId)),
        removeFromIndex(storage, pendingIndexPrefix, userId, ticketId),
      ]);
    },

    async savePass(pass: StoredEnrollmentPass): Promise<void> {
      await storage.setItem(
        recordKey(passPrefix, pass.userId, pass.ticketId),
        JSON.stringify(pass),
      );
      await addToIndex(storage, passIndexPrefix, pass.userId, pass.ticketId);
    },

    async savePending(pending: PendingPassIssuance): Promise<void> {
      await storage.setItem(
        recordKey(pendingPrefix, pending.userId, pending.ticketId),
        JSON.stringify(pending),
      );
      await addToIndex(storage, pendingIndexPrefix, pending.userId, pending.ticketId);
    },
  };
}

export type PassVault = ReturnType<typeof createPassVault>;
