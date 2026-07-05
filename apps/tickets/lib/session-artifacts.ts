export function clearFocacciaSessionArtifacts(storage: Pick<Storage, 'key' | 'length' | 'removeItem'>): void {
  const keys = Array.from({ length: storage.length }, (_value, index) => storage.key(index))
    .filter((key): key is string => key !== null)
    .filter((key) => key.startsWith('focaccia:ticket:') || key.startsWith('focaccia:idempotency:'));

  for (const key of keys) {
    storage.removeItem(key);
  }
}
