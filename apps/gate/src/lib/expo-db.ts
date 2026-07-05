import { openDatabaseAsync } from 'expo-sqlite';

import { GateRepository } from './gate-db';
import { ExpoSqliteDriver } from './expo-sqlite-driver';

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
