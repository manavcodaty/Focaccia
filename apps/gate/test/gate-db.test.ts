import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { GateRepository } from '../src/lib/gate-db.ts';
import { flushCheckinQueue } from '../src/lib/gate-sync-runner.ts';
import type { SqlDriver, SqlRunResult, SqlValue } from '../src/lib/sqlite-port.ts';
import type { GateLogEntry, PendingCheckinSync } from '../src/lib/types.ts';
import type { StoredGateConfig } from '../src/lib/types.ts';

class NodeSqliteDriver implements SqlDriver {
  readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  async exec(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async getAll<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.database.prepare(sql).all(...params) as T[];
  }

  async getFirst<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    return (this.database.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<SqlRunResult> {
    const result = this.database.prepare(sql).run(...params) as { changes: number };
    return { changes: result.changes };
  }

  async transaction<T>(task: (driver: SqlDriver) => Promise<T>): Promise<T> {
    this.database.exec('begin immediate');
    try {
      const result = await task(this);
      this.database.exec('commit');
      return result;
    } catch (error) {
      this.database.exec('rollback');
      throw error;
    }
  }
}

const log: GateLogEntry = {
  event_id: 'evt_gate',
  hamming_distance: 0,
  outcome: 'ACCEPT',
  pass_id: 'AQIDBAUGBwgJCgsMDQ4PEA',
  pass_ref: 'AQIDBAUG',
  reason_code: 'ACCEPT',
  recorded_at: '2026-06-14T08:30:00.000Z',
  timings: {
    decode_ms: 1,
    decrypt_ms: 1,
    liveness_ms: 1,
    match_ms: 1,
    replay_ms: 1,
    revocation_ms: 1,
    scan_ms: 1,
    total_ms: 8,
    verify_ms: 1,
  },
};

const syncItem: PendingCheckinSync = {
  attempt_count: 0,
  decision: 'ACCEPT',
  event_id: 'evt_gate',
  gate_timestamp: log.recorded_at,
  idempotency_key: '123e4567-e89b-42d3-a456-426614174000',
  last_error_code: null,
  next_attempt_at: log.recorded_at,
  nonce: 'AQIDBAUGBwgJCgsMDQ4PEA',
  pass_id: log.pass_id!,
  signature: 'A'.repeat(86),
  status: 'pending',
  synced_at: null,
};

const gateConfig: StoredGateConfig = {
  ends_at: '2026-06-14T12:00:00.000Z',
  event_id: 'evt_gate',
  event_name: 'Gate, "Main"',
  event_salt: 'A'.repeat(43),
  gate_device_id: '123e4567-e89b-42d3-a456-426614174000',
  key_version: 1,
  last_revocation_sync_at: null,
  pk_gate_event: 'B'.repeat(43),
  pk_sign_event: 'C'.repeat(43),
  policy: {
    liveness_timeout_ms: 5_000,
    match_threshold: 80,
    queue_code_enabled: false,
    single_entry: true,
    typed_token_fallback: true,
  },
  provisioned_at: '2026-06-14T07:00:00.000Z',
  starts_at: '2026-06-14T08:00:00.000Z',
  sync_public_key: 'D'.repeat(43),
};

test('persists gate configuration, revocations, logs, and non-sensitive CSV output', async () => {
  const database = new DatabaseSync(':memory:');
  const repository = new GateRepository(new NodeSqliteDriver(database));
  await repository.migrate();
  assert.equal(await repository.getGateConfig(), null);
  await repository.saveGateConfig(gateConfig);
  assert.deepEqual(await repository.getGateConfig(), gateConfig);

  await repository.replaceRevocations('evt_gate', [{
    pass_id: 'revoked-pass',
    revoked_at: '2026-06-14T08:10:00.000Z',
  }], '2026-06-14T08:11:00.000Z');
  assert.equal(await repository.isPassRevoked('evt_gate', 'revoked-pass'), true);
  assert.equal(await repository.isPassRevoked('evt_gate', 'active-pass'), false);
  await repository.updateRevocationSyncTimestamp('2026-06-14T08:12:00.000Z');
  assert.equal((await repository.getGateConfig())?.last_revocation_sync_at, '2026-06-14T08:12:00.000Z');

  assert.equal(await repository.markPassUsed('evt_gate', 'manual-pass', log.recorded_at), true);
  assert.equal(await repository.markPassUsed('evt_gate', 'manual-pass', log.recorded_at), false);
  await repository.insertLog({ ...log, pass_ref: 'ref,"quoted"' });
  const csv = await repository.exportLogsCsv();
  assert.match(csv, /"ref,""quoted"""/);
  assert.doesNotMatch(csv.toLowerCase(), /token|biometric|template|private_key/);
  assert.equal((await repository.getStats()).revocationCount, 1);
});

test('does not persist queue-code event secrets in gate configuration SQLite', async () => {
  const database = new DatabaseSync(':memory:');
  const repository = new GateRepository(new NodeSqliteDriver(database));
  await repository.migrate();

  await repository.saveGateConfig({
    ...gateConfig,
    k_code_event: 'queue-code-secret-that-must-not-be-stored',
    policy: {
      ...gateConfig.policy,
      queue_code_digits: 8,
      queue_code_enabled: true,
    },
  });

  const row = database.prepare('select k_code_event from gate_config limit 1').get() as {
    k_code_event: string | null;
  };
  assert.equal(row.k_code_event, null);
  assert.equal((await repository.getGateConfig())?.k_code_event, undefined);
});

test('migrates an existing gate_config table with signed-sync columns', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    create table gate_config (
      event_id text primary key, event_name text not null, event_salt text not null,
      pk_gate_event text not null, pk_sign_event text not null, starts_at text not null,
      ends_at text not null, match_threshold integer not null, liveness_timeout_ms integer not null,
      single_entry integer not null, typed_token_fallback integer not null,
      queue_code_enabled integer not null, queue_code_digits integer, k_code_event text,
      provisioned_at text not null, last_revocation_sync_at text
    );
  `);
  const driver = new NodeSqliteDriver(database);
  const repository = new GateRepository(driver);
  await repository.migrate();
  const columns = await driver.getAll<{ name: string }>('pragma table_info(gate_config)');
  assert.ok(columns.some((column) => column.name === 'gate_device_id'));
  assert.ok(columns.some((column) => column.name === 'key_version'));
  assert.ok(columns.some((column) => column.name === 'sync_public_key'));
});

test('commits replay marker, accepted log, and queue row atomically and survives restart', async () => {
  const database = new DatabaseSync(':memory:');
  const repository = new GateRepository(new NodeSqliteDriver(database));
  await repository.migrate();

  assert.equal(await repository.recordAcceptedDecision(log, syncItem), true);
  assert.equal(await repository.recordAcceptedDecision(log, { ...syncItem, idempotency_key: '223e4567-e89b-42d3-a456-426614174000' }), false);
  assert.equal(await repository.isPassUsed(log.event_id, log.pass_id!), true);
  assert.equal((await repository.listLogs()).length, 1);
  assert.equal((await repository.listDueSyncItems(log.recorded_at)).length, 1);

  const reopened = new GateRepository(new NodeSqliteDriver(database));
  await reopened.migrate();
  assert.equal((await reopened.listDueSyncItems(log.recorded_at))[0]?.idempotency_key, syncItem.idempotency_key);

  const columns = await new NodeSqliteDriver(database).getAll<{ name: string }>('pragma table_info(checkin_sync_queue)');
  const names = columns.map((column) => column.name);
  for (const forbidden of ['token', 'biometric', 'embedding', 'template', 'private_key', 'access_token']) {
    assert.equal(names.some((name) => name.includes(forbidden)), false, `queue includes ${forbidden}`);
  }
});

test('rolls back replay marking when queue persistence fails', async () => {
  const database = new DatabaseSync(':memory:');
  const driver = new NodeSqliteDriver(database);
  const repository = new GateRepository(driver);
  await repository.migrate();
  database.exec(`
    create trigger reject_queue_insert before insert on checkin_sync_queue
    begin select raise(abort, 'queue unavailable'); end;
  `);

  await assert.rejects(repository.recordAcceptedDecision(log, syncItem), /queue unavailable/);
  assert.equal(await repository.isPassUsed(log.event_id, log.pass_id!), false);
  assert.equal((await repository.listLogs()).length, 0);
});

test('tracks retry, blocked, and synchronized queue states', async () => {
  const database = new DatabaseSync(':memory:');
  const repository = new GateRepository(new NodeSqliteDriver(database));
  await repository.migrate();
  await repository.recordAcceptedDecision(log, syncItem);

  await repository.markSyncRetry(syncItem.idempotency_key, 1, '2026-06-14T08:31:00.000Z', 'network_error');
  assert.equal((await repository.listDueSyncItems('2026-06-14T08:30:59.000Z')).length, 0);
  assert.equal((await repository.listDueSyncItems('2026-06-14T08:31:00.000Z')).length, 1);
  await repository.markSyncBlocked(syncItem.idempotency_key, 'invalid_gate_signature');
  assert.equal((await repository.getStats()).blockedSyncCount, 1);
  await repository.markSyncSucceeded(syncItem.idempotency_key, '2026-06-14T08:32:00.000Z');
  const stats = await repository.getStats();
  assert.equal(stats.pendingSyncCount, 0);
  assert.equal(stats.blockedSyncCount, 0);
  assert.equal(stats.syncedCheckinCount, 1);
});

test('queue runner retries transport failures and treats duplicate receipt as success', async () => {
  const database = new DatabaseSync(':memory:');
  const repository = new GateRepository(new NodeSqliteDriver(database));
  await repository.migrate();
  await repository.recordAcceptedDecision(log, syncItem);

  const retried = await flushCheckinQueue({
    jitter: 0,
    now: new Date(log.recorded_at),
    repository,
    send: async () => {
      throw new Error('offline');
    },
  });
  assert.deepEqual(retried, { blocked: 0, pending: 1, synced: 0 });
  assert.equal(
    await repository.getNextSyncAttemptAt(),
    '2026-06-14T08:30:05.000Z',
  );

  const duplicate = await flushCheckinQueue({
    now: new Date('2026-06-14T08:30:05.000Z'),
    repository,
    send: async () => ({ idempotent_replay: true }),
  });
  assert.deepEqual(duplicate, { blocked: 0, pending: 0, synced: 1 });
});

test('queue runner blocks signature failures until manual retry', async () => {
  const database = new DatabaseSync(':memory:');
  const repository = new GateRepository(new NodeSqliteDriver(database));
  await repository.migrate();
  await repository.recordAcceptedDecision(log, syncItem);

  const result = await flushCheckinQueue({
    now: new Date(log.recorded_at),
    repository,
    send: async () => {
      throw { code: 'invalid_gate_signature', status: 403 };
    },
  });
  assert.deepEqual(result, { blocked: 1, pending: 0, synced: 0 });
  assert.equal((await repository.getStats()).blockedSyncCount, 1);
  await repository.retryBlockedSyncItems('2026-06-14T08:31:00.000Z');
  assert.equal((await repository.listDueSyncItems('2026-06-14T08:31:00.000Z')).length, 1);
});
