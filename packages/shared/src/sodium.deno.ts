import sodiumModule from "./vendor/libsodium/libsodium-wrappers.mjs";

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
  crypto_sign_detached(message: Uint8Array, privateKey: Uint8Array): Uint8Array;
  crypto_sign_keypair(): SodiumKeyPair;
  crypto_sign_seed_keypair(seed: Uint8Array): SodiumKeyPair;
  crypto_sign_verify_detached(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array,
  ): boolean;
  crypto_secretbox_easy(
    message: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_secretbox_open_easy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_secretbox_KEYBYTES: number;
  crypto_secretbox_NONCEBYTES: number;
  from_base64(value: string, variant?: number): Uint8Array;
  randombytes_buf(length: number): Uint8Array;
  to_base64(value: Uint8Array, variant?: number): string;
}

const sodium = sodiumModule as unknown as SodiumApi & { ready: Promise<void> };

let sodiumPromise: Promise<SodiumApi> | undefined;

export async function getSodium(): Promise<SodiumApi> {
  if (!sodiumPromise) {
    sodiumPromise = (async () => {
      await sodium.ready;
      return sodium;
    })();
  }

  return sodiumPromise;
}
