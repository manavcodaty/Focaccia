export interface KeyStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export function idempotencyStorageKey(operation: string, resourceId: string): string {
  return `focaccia:idempotency:${operation}:${resourceId}`;
}

export function createUuidV4(
  fillRandom: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes),
): string {
  const bytes = fillRandom(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreateIdempotencyKey(
  storage: KeyStorage,
  operation: string,
  resourceId: string,
  createUuid: () => string = createUuidV4,
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
