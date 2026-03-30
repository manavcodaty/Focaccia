import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { GateRepository } from './gate-db';
import type { SqlDriver, SqlValue } from './sqlite-port';

class ExpoSqliteDriver implements SqlDriver {
  constructor(private readonly database: SQLiteDatabase) {}

  async exec(sql: string): Promise<void> {
    await this.database.execAsync(sql);
  }

  async getAll<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.database.getAllAsync<T>(sql, [...params]);
  }

  async getFirst<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    return this.database.getFirstAsync<T>(sql, [...params]);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    await this.database.runAsync(sql, [...params]);
  }
}

let repositoryPromise: Promise<GateRepository> | null = null;

export async function openGateRepository(): Promise<GateRepository> {
  if (!repositoryPromise) {
    repositoryPromise = openDatabaseAsync('face-pass-gate.db').then(async (database) => {
      const repository = new GateRepository(new ExpoSqliteDriver(database));
      await repository.migrate();
      return repository;
    });
  }

  return repositoryPromise;
}
