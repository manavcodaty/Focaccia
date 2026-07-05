import assert from 'node:assert/strict';
import test from 'node:test';

import { ExpoSqliteDriver } from '../src/lib/expo-sqlite-driver.ts';

import type { SqlValue } from '../src/lib/sqlite-port.ts';

class FakeExpoDatabase {
  transactionCalls = 0;

  async execAsync(): Promise<void> {}

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }

  async getFirstAsync<T>(): Promise<T | null> {
    return null;
  }

  async runAsync(): Promise<{ changes: number }> {
    return { changes: 1 };
  }

  async withExclusiveTransactionAsync<T>(task: (transaction: FakeExpoDatabase) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    return task(this);
  }
}

test('Expo SQLite transactions may intentionally complete without a return value', async () => {
  const database = new FakeExpoDatabase();
  const driver = new ExpoSqliteDriver(database as never);

  const result = await driver.transaction(async (transaction) => {
    await transaction.run('update gate_config set last_revocation_sync_at = ?', [
      '2026-07-04T09:00:00.000Z',
    ] satisfies SqlValue[]);
  });

  assert.equal(result, undefined);
  assert.equal(database.transactionCalls, 1);
});
