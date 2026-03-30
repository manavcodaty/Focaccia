import type { GateBundle } from '@face-pass/shared';

import {
  configRowToStoredGateConfig,
  type GateConfigRow,
  type GateLogEntry,
  type GateLogRow,
  type GateStats,
  type StoredGateConfig,
} from './types.ts';
import type { SqlDriver, SqlValue } from './sqlite-port.ts';

const SCHEMA_SQL = `
create table if not exists gate_config (
  event_id text primary key,
  event_name text not null,
  event_salt text not null,
  pk_gate_event text not null,
  pk_sign_event text not null,
  starts_at text not null,
  ends_at text not null,
  match_threshold integer not null,
  liveness_timeout_ms integer not null,
  single_entry integer not null,
  typed_token_fallback integer not null,
  queue_code_enabled integer not null,
  queue_code_digits integer,
  k_code_event text,
  provisioned_at text not null,
  last_revocation_sync_at text
);

create table if not exists used_passes (
  pass_id text primary key,
  event_id text not null,
  accepted_at text not null
);

create table if not exists revocation_cache (
  event_id text not null,
  pass_id text not null,
  revoked_at text not null,
  primary key (event_id, pass_id)
);

create table if not exists scan_logs (
  id integer primary key autoincrement,
  recorded_at text not null,
  event_id text not null,
  pass_id text,
  pass_ref text,
  outcome text not null,
  reason_code text not null,
  scan_ms integer not null,
  decode_ms integer not null,
  verify_ms integer not null,
  replay_ms integer not null,
  revocation_ms integer not null,
  decrypt_ms integer not null,
  liveness_ms integer not null,
  match_ms integer not null,
  total_ms integer not null,
  hamming_distance integer
);
`;

function numberToBoolean(value: boolean): number {
  return value ? 1 : 0;
}

function queueCodeDigits(bundle: GateBundle): number | null {
  return bundle.policy.queue_code_digits ?? null;
}

function rowParams(config: StoredGateConfig): SqlValue[] {
  return [
    config.event_id,
    config.event_name,
    config.event_salt,
    config.pk_gate_event,
    config.pk_sign_event,
    config.starts_at,
    config.ends_at,
    config.policy.match_threshold,
    config.policy.liveness_timeout_ms,
    numberToBoolean(config.policy.single_entry),
    numberToBoolean(config.policy.typed_token_fallback),
    numberToBoolean(config.policy.queue_code_enabled),
    queueCodeDigits(config),
    config.k_code_event ?? null,
    config.provisioned_at,
    config.last_revocation_sync_at,
  ];
}

function csvEscape(value: string | number | null): string {
  if (value === null) {
    return '';
  }

  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export class GateRepository {
  private readonly driver: SqlDriver;

  constructor(driver: SqlDriver) {
    this.driver = driver;
  }

  async migrate(): Promise<void> {
    await this.driver.exec(SCHEMA_SQL);
  }

  async close(): Promise<void> {
    if (this.driver.close) {
      await this.driver.close();
    }
  }

  async getGateConfig(): Promise<StoredGateConfig | null> {
    const row = await this.driver.getFirst<GateConfigRow>(
      `select
        event_id,
        event_name,
        event_salt,
        pk_gate_event,
        pk_sign_event,
        starts_at,
        ends_at,
        match_threshold,
        liveness_timeout_ms,
        single_entry,
        typed_token_fallback,
        queue_code_enabled,
        queue_code_digits,
        k_code_event,
        provisioned_at,
        last_revocation_sync_at
      from gate_config
      limit 1`,
    );

    return row ? configRowToStoredGateConfig(row) : null;
  }

  async saveGateConfig(config: StoredGateConfig): Promise<void> {
    await this.driver.run('delete from gate_config');
    await this.driver.run(
      `insert into gate_config (
        event_id,
        event_name,
        event_salt,
        pk_gate_event,
        pk_sign_event,
        starts_at,
        ends_at,
        match_threshold,
        liveness_timeout_ms,
        single_entry,
        typed_token_fallback,
        queue_code_enabled,
        queue_code_digits,
        k_code_event,
        provisioned_at,
        last_revocation_sync_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rowParams(config),
    );
  }

  async updateRevocationSyncTimestamp(timestampIso: string): Promise<void> {
    await this.driver.run('update gate_config set last_revocation_sync_at = ?', [timestampIso]);
  }

  async replaceRevocations(
    eventId: string,
    revocations: ReadonlyArray<{ pass_id: string; revoked_at: string }>,
    syncedAtIso: string,
  ): Promise<void> {
    await this.driver.run('delete from revocation_cache where event_id = ?', [eventId]);

    for (const row of revocations) {
      await this.driver.run(
        'insert into revocation_cache (event_id, pass_id, revoked_at) values (?, ?, ?)',
        [eventId, row.pass_id, row.revoked_at],
      );
    }

    await this.updateRevocationSyncTimestamp(syncedAtIso);
  }

  async isPassRevoked(eventId: string, passId: string): Promise<boolean> {
    const row = await this.driver.getFirst<{ pass_id: string }>(
      'select pass_id from revocation_cache where event_id = ? and pass_id = ? limit 1',
      [eventId, passId],
    );

    return row !== null;
  }

  async isPassUsed(eventId: string, passId: string): Promise<boolean> {
    const row = await this.driver.getFirst<{ pass_id: string }>(
      'select pass_id from used_passes where event_id = ? and pass_id = ? limit 1',
      [eventId, passId],
    );

    return row !== null;
  }

  async markPassUsed(eventId: string, passId: string, acceptedAtIso: string): Promise<void> {
    await this.driver.run(
      'insert or replace into used_passes (pass_id, event_id, accepted_at) values (?, ?, ?)',
      [passId, eventId, acceptedAtIso],
    );
  }

  async insertLog(entry: GateLogEntry): Promise<void> {
    await this.driver.run(
      `insert into scan_logs (
        recorded_at,
        event_id,
        pass_id,
        pass_ref,
        outcome,
        reason_code,
        scan_ms,
        decode_ms,
        verify_ms,
        replay_ms,
        revocation_ms,
        decrypt_ms,
        liveness_ms,
        match_ms,
        total_ms,
        hamming_distance
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.recorded_at,
        entry.event_id,
        entry.pass_id,
        entry.pass_ref,
        entry.outcome,
        entry.reason_code,
        entry.timings.scan_ms,
        entry.timings.decode_ms,
        entry.timings.verify_ms,
        entry.timings.replay_ms,
        entry.timings.revocation_ms,
        entry.timings.decrypt_ms,
        entry.timings.liveness_ms,
        entry.timings.match_ms,
        entry.timings.total_ms,
        entry.hamming_distance,
      ],
    );
  }

  async listLogs(): Promise<GateLogRow[]> {
    return this.driver.getAll<GateLogRow>(
      `select
        id,
        recorded_at,
        event_id,
        pass_id,
        pass_ref,
        outcome,
        reason_code,
        scan_ms,
        decode_ms,
        verify_ms,
        replay_ms,
        revocation_ms,
        decrypt_ms,
        liveness_ms,
        match_ms,
        total_ms,
        hamming_distance
      from scan_logs
      order by recorded_at desc, id desc`,
    );
  }

  async getStats(): Promise<GateStats> {
    const counts = await this.driver.getFirst<{
      lastRecordedAt: string | null;
      logCount: number;
      revocationCount: number;
      usedPassCount: number;
    }>(
      `select
        (select count(*) from scan_logs) as logCount,
        (select count(*) from used_passes) as usedPassCount,
        (select count(*) from revocation_cache) as revocationCount,
        (select recorded_at from scan_logs order by recorded_at desc, id desc limit 1) as lastRecordedAt`,
    );

    return {
      lastRecordedAt: counts?.lastRecordedAt ?? null,
      logCount: counts?.logCount ?? 0,
      revocationCount: counts?.revocationCount ?? 0,
      usedPassCount: counts?.usedPassCount ?? 0,
    };
  }

  async exportLogsCsv(): Promise<string> {
    const rows = await this.listLogs();
    const header = [
      'recorded_at',
      'event_id',
      'pass_ref',
      'outcome',
      'reason_code',
      'scan_ms',
      'decode_ms',
      'verify_ms',
      'replay_ms',
      'revocation_ms',
      'decrypt_ms',
      'liveness_ms',
      'match_ms',
      'total_ms',
      'hamming_distance',
    ];
    const csvRows = rows.map((row) =>
      [
        row.recorded_at,
        row.event_id,
        row.pass_ref,
        row.outcome,
        row.reason_code,
        row.scan_ms,
        row.decode_ms,
        row.verify_ms,
        row.replay_ms,
        row.revocation_ms,
        row.decrypt_ms,
        row.liveness_ms,
        row.match_ms,
        row.total_ms,
        row.hamming_distance,
      ]
        .map((value) => csvEscape(value))
        .join(','));

    return [header.join(','), ...csvRows].join('\n');
  }
}
