import sodium from '@more-tech/react-native-libsodium';

import type { SodiumApi } from './sodium';

type NativeSodiumModule = SodiumApi & {
  ready?: Promise<void>;
};

let sodiumPromise: Promise<SodiumApi> | undefined;

export async function getSodium(): Promise<SodiumApi> {
  if (!sodiumPromise) {
    sodiumPromise = (async () => {
      const nativeSodium = sodium as unknown as NativeSodiumModule;

      if (nativeSodium.ready) {
        await nativeSodium.ready;
      }

      return nativeSodium;
    })();
  }

  return sodiumPromise;
}

export type { SodiumApi, SodiumKeyPair } from './sodium';
