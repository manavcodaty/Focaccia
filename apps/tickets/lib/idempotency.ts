export interface KeyStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export function idempotencyStorageKey(operation: string, resourceId: string): string {
  return `focaccia:idempotency:${operation}:${resourceId}`;
}

export function getOrCreateIdempotencyKey(
  storage: KeyStorage,
  operation: string,
  resourceId: string,
  createUuid: () => string = () => crypto.randomUUID(),
): string {
  const key = idempotencyStorageKey(operation, resourceId);
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = createUuid();
  storage.setItem(key, created);
  return created;
}

export function clearIdempotencyKey(storage: KeyStorage, operation: string, resourceId: string): void {
  storage.removeItem(idempotencyStorageKey(operation, resourceId));
}
