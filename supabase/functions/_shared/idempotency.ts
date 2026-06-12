import {
  canonicalJsonStringify,
  isLowercaseUuidV4,
  type CanonicalJsonValue,
} from './face-pass-shared.ts';
import { exposedApiError } from './api.ts';

export function requireIdempotencyKey(req: Request): string {
  const value = req.headers.get('Idempotency-Key')?.trim();

  if (!value || !isLowercaseUuidV4(value)) {
    throw exposedApiError(
      422,
      'invalid_idempotency_key',
      'Idempotency-Key must be a lowercase RFC 4122 UUID v4.',
    );
  }

  return value;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function operationRequestHash(
  operation: string,
  body: CanonicalJsonValue,
): Promise<string> {
  return sha256Hex(canonicalJsonStringify({ body, operation }));
}
