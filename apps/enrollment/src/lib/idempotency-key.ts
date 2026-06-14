import { randomBytes } from '@face-pass/shared';

export function formatUuidV4(source: Uint8Array): string {
  if (source.length !== 16) {
    throw new Error('UUID v4 generation requires exactly 16 bytes.');
  }

  const bytes = Uint8Array.from(source);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function createIdempotencyKey(
  randomSource: (length: number) => Promise<Uint8Array> = randomBytes,
): Promise<string> {
  const bytes = await randomSource(16);
  try {
    return formatUuidV4(bytes);
  } finally {
    bytes.fill(0);
  }
}
