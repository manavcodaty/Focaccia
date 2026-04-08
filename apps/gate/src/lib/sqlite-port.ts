export type SqlValue = null | number | string;

export interface SqlRunResult {
  changes: number;
}

export interface SqlDriver {
  close?(): Promise<void>;
  exec(sql: string): Promise<void>;
  getAll<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  getFirst<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  run(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult>;
}
