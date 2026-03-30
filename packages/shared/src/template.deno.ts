import { getSodium } from './sodium.deno.ts';

const TEMPLATE_BITS = 256;
const TEMPLATE_BYTES = TEMPLATE_BITS / 8;
const BLAKE2B_BYTES = 64;
const EVENT_SALT_BYTES = 32;

const POPCOUNT_TABLE = Uint8Array.from({ length: 256 }, (_, value) => {
  let remaining = value;
  let count = 0;

  while (remaining > 0) {
    count += remaining & 1;
    remaining >>= 1;
  }

  return count;
});

function normalizeEmbedding(embedding: ArrayLike<number>): Float64Array {
  if (embedding.length === 0) {
    throw new RangeError('Embedding must contain at least one dimension.');
  }

  if (embedding.length > 0xffff) {
    throw new RangeError('Embedding length must fit into an unsigned 16-bit integer.');
  }

  const normalized = new Float64Array(embedding.length);
  let sumSquares = 0;

  for (let index = 0; index < embedding.length; index += 1) {
    const value = Number(embedding[index]);

    if (!Number.isFinite(value)) {
      throw new TypeError(`Embedding value at index ${index} is not finite.`);
    }

    normalized[index] = value;
    sumSquares += value * value;
  }

  const magnitude = Math.sqrt(sumSquares);

  if (!(magnitude > 0)) {
    throw new RangeError('Embedding magnitude must be greater than zero.');
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const currentValue = normalized[index];

    if (currentValue === undefined) {
      throw new RangeError(`Embedding normalization failed at index ${index}.`);
    }

    normalized[index] = currentValue / magnitude;
  }

  return normalized;
}

export async function cancelableTemplateV1(
  embedding: ArrayLike<number>,
  eventSalt: Uint8Array,
): Promise<Uint8Array> {
  if (eventSalt.length !== EVENT_SALT_BYTES) {
    throw new RangeError('Event salt must be exactly 32 bytes.');
  }

  const sodium = await getSodium();
  const normalizedEmbedding = normalizeEmbedding(embedding);
  const template = new Uint8Array(TEMPLATE_BYTES);
  const hashInput = new Uint8Array(EVENT_SALT_BYTES + 4);
  const hashView = new DataView(
    hashInput.buffer,
    hashInput.byteOffset + EVENT_SALT_BYTES,
    4,
  );

  hashInput.set(eventSalt, 0);

  try {
    for (let bitIndex = 0; bitIndex < TEMPLATE_BITS; bitIndex += 1) {
      let sum = 0;
      hashView.setUint16(0, bitIndex, false);

      for (
        let dimensionIndex = 0;
        dimensionIndex < normalizedEmbedding.length;
        dimensionIndex += 1
      ) {
        hashView.setUint16(2, dimensionIndex, false);

        const hash = sodium.crypto_generichash(BLAKE2B_BYTES, hashInput, null);
        const firstByte = hash[0];
        const sign = ((firstByte ?? 0) & 0x80) === 0 ? 1 : -1;
        const normalizedValue = normalizedEmbedding[dimensionIndex];

        if (normalizedValue === undefined) {
          throw new RangeError(`Normalized embedding is missing index ${dimensionIndex}.`);
        }

        sum += normalizedValue * sign;
      }

      if (sum >= 0) {
        const byteIndex = bitIndex >> 3;
        const currentByte = template[byteIndex];

        if (currentByte === undefined) {
          throw new RangeError(`Template byte index ${byteIndex} is out of bounds.`);
        }

        template[byteIndex] = currentByte | (1 << (7 - (bitIndex & 7)));
      }
    }
  } finally {
    normalizedEmbedding.fill(0);
    hashInput.fill(0);
  }

  return template;
}

export function hammingDistance(
  left: Uint8Array,
  right: Uint8Array,
): number {
  if (left.length !== right.length) {
    throw new RangeError('Hamming distance requires byte arrays of equal length.');
  }

  let distance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftByte = left[index];
    const rightByte = right[index];

    if (leftByte === undefined || rightByte === undefined) {
      throw new RangeError(`Byte index ${index} is out of bounds.`);
    }

    const xor = leftByte ^ rightByte;
    distance += POPCOUNT_TABLE[xor] ?? 0;
  }

  return distance;
}
