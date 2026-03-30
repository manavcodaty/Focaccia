import type { CanonicalJsonValue } from './canonical-json.ts';
import { canonicalJsonBytes } from './canonical-json.ts';
import { getSodium, type SodiumKeyPair } from './sodium.deno.ts';

export interface Ed25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyType: 'ed25519';
}

export interface X25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyType: 'x25519';
}

function toEd25519KeyPair(keyPair: SodiumKeyPair): Ed25519KeyPair {
  if (keyPair.keyType !== 'ed25519') {
    throw new TypeError(`Expected an Ed25519 keypair, received ${keyPair.keyType}.`);
  }

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    keyType: 'ed25519',
  };
}

function toX25519KeyPair(keyPair: SodiumKeyPair): X25519KeyPair {
  if (keyPair.keyType !== 'x25519') {
    throw new TypeError(`Expected an X25519 keypair, received ${keyPair.keyType}.`);
  }

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    keyType: 'x25519',
  };
}

function assertSeedLength(seed: Uint8Array): void {
  if (seed.length !== 32) {
    throw new RangeError('Ed25519 seed must be exactly 32 bytes.');
  }
}

export async function prepareCrypto(): Promise<void> {
  await getSodium();
}

export async function blake2b(
  message: Uint8Array,
  outputLength = 64,
): Promise<Uint8Array> {
  if (outputLength < 1 || outputLength > 64) {
    throw new RangeError('BLAKE2b output length must be between 1 and 64 bytes.');
  }

  const sodium = await getSodium();
  return sodium.crypto_generichash(outputLength, message, null);
}

export async function canonicalJsonSignature(
  payload: CanonicalJsonValue,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  return ed25519SignDetached(canonicalJsonBytes(payload), privateKey);
}

export async function ed25519Keypair(): Promise<Ed25519KeyPair> {
  const sodium = await getSodium();
  return toEd25519KeyPair(sodium.crypto_sign_keypair());
}

export async function ed25519KeypairFromSeed(
  seed: Uint8Array,
): Promise<Ed25519KeyPair> {
  assertSeedLength(seed);

  const sodium = await getSodium();
  return toEd25519KeyPair(sodium.crypto_sign_seed_keypair(seed));
}

export async function ed25519SignDetached(
  message: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_sign_detached(message, privateKey);
}

export async function ed25519VerifyDetached(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  const sodium = await getSodium();
  return sodium.crypto_sign_verify_detached(signature, message, publicKey);
}

export async function x25519Keypair(): Promise<X25519KeyPair> {
  const sodium = await getSodium();
  return toX25519KeyPair(sodium.crypto_box_keypair());
}

export async function x25519Seal(
  message: Uint8Array,
  publicKey: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_box_seal(message, publicKey);
}

export async function x25519SealOpen(
  ciphertext: Uint8Array,
  publicKey: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_box_seal_open(ciphertext, publicKey, privateKey);
}

export async function toBase64Url(value: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export async function fromBase64Url(value: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}
