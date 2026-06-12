import {
  canonicalizeClaimCode,
  claimCodeFromEntropy,
  fromBase64Url,
  isValidClaimCode,
} from './face-pass-shared.ts';
import { exposedApiError } from './api.ts';
import { getRuntimeConfig } from './env.ts';
import { decryptServerSecret, encryptServerSecret } from './secret-store.ts';

export { canonicalizeClaimCode };

export function generateClaimCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return claimCodeFromEntropy(bytes);
}

export function validateClaimCode(value: string): string {
  const canonical = canonicalizeClaimCode(value);

  if (!isValidClaimCode(canonical)) {
    throw exposedApiError(404, 'ticket_not_found', 'Ticket not found.');
  }

  return canonical;
}

async function pepperKey(): Promise<CryptoKey> {
  const bytes = await fromBase64Url(getRuntimeConfig().claimCodePepperBase64Url);
  return crypto.subtle.importKey('raw', bytes, { hash: 'SHA-256', name: 'HMAC' }, false, ['sign']);
}

export async function protectedServerDigest(value: string): Promise<string> {
  const digest = await crypto.subtle.sign(
    'HMAC',
    await pepperKey(),
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function claimCodeDigest(canonical: string): Promise<string> {
  return protectedServerDigest(canonical);
}

export async function encryptClaimCode(displayCode: string): Promise<string> {
  return encryptServerSecret(new TextEncoder().encode(displayCode));
}

export async function decryptClaimCode(ciphertext: string): Promise<string> {
  const plaintext = await decryptServerSecret(ciphertext);

  try {
    return new TextDecoder().decode(plaintext);
  } finally {
    plaintext.fill(0);
  }
}
