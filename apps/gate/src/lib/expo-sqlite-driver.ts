import type { SQLiteDatabase } from 'expo-sqlite';

import type { SqlDriver, SqlRunResult, SqlValue } from './sqlite-port';

export class ExpoSqliteDriver implements SqlDriver {
  private readonly database: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  async exec(sql: string): Promise<void> {
    await this.database.execAsync(sql);
  }

  async getAll<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.database.getAllAsync<T>(sql, [...params]);
  }

  async getFirst<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    return this.database.getFirstAsync<T>(sql, [...params]);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<SqlRunResult> {
    const result = await this.database.runAsync(sql, [...params]);
    return { changes: result.changes };
  }

  async transaction<T>(task: (driver: SqlDriver) => Promise<T>): Promise<T> {
    let value: T | undefined;
    let completed = false;

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      value = await task(new ExpoSqliteDriver(transaction));
      completed = true;
    });

    if (!completed) {
      throw new Error('SQLite transaction completed without a result.');
    }

    return value as T;
  }
}
