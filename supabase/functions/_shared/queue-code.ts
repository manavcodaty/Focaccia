import sodium from 'npm:libsodium-wrappers@0.8.2';

import { getRuntimeConfig } from './env.ts';

const textEncoder = new TextEncoder();

export async function computeQueueCode(
  eventId: string,
  passId: string,
  key: Uint8Array,
): Promise<string> {
  await sodium.ready;

  const payload = textEncoder.encode(`${eventId}:${passId}`);
  const digest = sodium.crypto_generichash(8, payload, key);
  let value = 0n;

  for (let index = 0; index < digest.length; index += 1) {
    const next = digest[index];

    if (next === undefined) {
      throw new RangeError(`Digest index ${index} is out of bounds.`);
    }

    value = (value << 8n) | BigInt(next);
  }

  const digits = getRuntimeConfig().queueCodeDigits;
  const modulus = 10n ** BigInt(digits);

  return (value % modulus).toString().padStart(digits, '0');
}
