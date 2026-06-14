import * as SecureStore from 'expo-secure-store';

import type { SecureKeyValueStore } from './pass-vault';

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureKeyValueStore: SecureKeyValueStore = {
  async deleteItem(key) {
    await SecureStore.deleteItemAsync(key, secureOptions);
  },
  getItem(key) {
    return SecureStore.getItemAsync(key, secureOptions);
  },
  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value, secureOptions);
  },
};

export const supabaseSecureStorage = {
  getItem(key: string) {
    return secureKeyValueStore.getItem(key);
  },
  removeItem(key: string) {
    return secureKeyValueStore.deleteItem(key);
  },
  setItem(key: string, value: string) {
    return secureKeyValueStore.setItem(key, value);
  },
};
