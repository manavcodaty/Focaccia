import * as SecureStore from 'expo-secure-store';

import type { SecureValueStore } from './secure-value-store';

export const expoSecureValueStore: SecureValueStore = {
  async deleteItem(key) {
    await SecureStore.deleteItemAsync(key);
  },
  async getItem(key) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};
