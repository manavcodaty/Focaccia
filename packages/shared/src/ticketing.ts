export const CLAIM_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const CLAIM_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{12}$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type TicketStatus = 'claimed' | 'enrolled' | 'checked_in' | 'cancelled' | 'revoked';

export function canonicalizeClaimCode(value: string): string {
  return value.replace(/-/g, '').trim().toUpperCase();
}

export function formatClaimCode(canonical: string): string {
  if (!CLAIM_CODE_PATTERN.test(canonical)) {
    throw new TypeError('Claim code must contain exactly 12 Crockford Base32 characters.');
  }
  return `${canonical.slice(0, 4)}-${canonical.slice(4, 8)}-${canonical.slice(8, 12)}`;
}

export function claimCodeFromEntropy(entropy: Uint8Array): string {
  if (entropy.length !== 8) {
    throw new RangeError('Claim-code entropy must contain exactly 8 bytes.');
  }

  let value = BigInt(0);
  for (const byte of entropy) value = (value << BigInt(8)) | BigInt(byte);
  value &= (BigInt(1) << BigInt(60)) - BigInt(1);
  let canonical = '';
  for (let index = 0; index < 12; index += 1) {
    canonical = CLAIM_CODE_ALPHABET[Number(value & BigInt(31))] + canonical;
    value >>= BigInt(5);
  }
  return formatClaimCode(canonical);
}

export function isValidClaimCode(value: string): boolean {
  return CLAIM_CODE_PATTERN.test(canonicalizeClaimCode(value));
}

export function isLowercaseUuidV4(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

export function isAllowedTicketTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true;
  if (from === 'claimed') return ['enrolled', 'cancelled', 'revoked'].includes(to);
  if (from === 'enrolled') return ['checked_in', 'cancelled', 'revoked'].includes(to);
  return false;
}
