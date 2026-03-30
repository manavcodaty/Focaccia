import { fromBase64Url, toBase64Url } from '@face-pass/shared';

export interface SecureValueStore {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function storageKey(eventId: string): string {
  return `face-pass:gate:sk:${eventId}`;
}

export async function loadGatePrivateKey(
  store: SecureValueStore,
  eventId: string,
): Promise<Uint8Array | null> {
  const encoded = await store.getItem(storageKey(eventId));

  return encoded ? fromBase64Url(encoded) : null;
}

export async function saveGatePrivateKey(
  store: SecureValueStore,
  eventId: string,
  privateKey: Uint8Array,
): Promise<void> {
  await store.setItem(storageKey(eventId), await toBase64Url(privateKey));
}

export async function deleteGatePrivateKey(
  store: SecureValueStore,
  eventId: string,
): Promise<void> {
  await store.deleteItem(storageKey(eventId));
}
