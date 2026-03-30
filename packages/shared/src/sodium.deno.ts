import sodium from 'npm:libsodium-wrappers@0.8.2';

export interface SodiumKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyType: string;
}

export interface SodiumApi {
  base64_variants: {
    URLSAFE_NO_PADDING: number;
  };
  crypto_box_keypair(): SodiumKeyPair;
  crypto_box_seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array;
  crypto_box_seal_open(
    ciphertext: Uint8Array,
    publicKey: Uint8Array,
    privateKey: Uint8Array,
  ): Uint8Array;
  crypto_generichash(
    hashLength: number,
    message: Uint8Array,
    key: Uint8Array | null,
  ): Uint8Array;
  crypto_sign_detached(
    message: Uint8Array,
    privateKey: Uint8Array,
  ): Uint8Array;
  crypto_sign_keypair(): SodiumKeyPair;
  crypto_sign_seed_keypair(seed: Uint8Array): SodiumKeyPair;
  crypto_sign_verify_detached(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array,
  ): boolean;
  from_base64(value: string, variant?: number): Uint8Array;
  to_base64(value: Uint8Array, variant?: number): string;
}

let sodiumPromise: Promise<SodiumApi> | undefined;

export async function getSodium(): Promise<SodiumApi> {
  if (!sodiumPromise) {
    sodiumPromise = (async () => {
      const sodiumModule = sodium as unknown as SodiumApi & {
        ready: Promise<void>;
      };

      await sodiumModule.ready;
      return sodiumModule;
    })();
  }

  return sodiumPromise;
}
