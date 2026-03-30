const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateJoinCode(length = 8): string {
  const random = randomBytes(length);
  let value = '';

  for (let index = 0; index < random.length; index += 1) {
    const next = random[index];

    if (next === undefined) {
      throw new RangeError(`Random byte index ${index} is out of bounds.`);
    }

    value += JOIN_CODE_ALPHABET[next % JOIN_CODE_ALPHABET.length];
  }

  return value;
}
