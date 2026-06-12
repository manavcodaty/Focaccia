import {
  canonicalizeClaimCode,
  claimCodeFromEntropy,
  formatClaimCode,
  isAllowedTicketTransition,
  isLowercaseUuidV4,
  isValidClaimCode,
} from '../src/ticketing';

describe('ticketing helpers', () => {
  test('creates a stable 60-bit formatted claim code', () => {
    expect(claimCodeFromEntropy(Uint8Array.from([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88])))
      .toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){2}$/);
  });

  test('rejects entropy with the wrong size', () => {
    expect(() => claimCodeFromEntropy(new Uint8Array(7))).toThrow(/exactly 8 bytes/);
  });

  test('normalizes and validates display claim codes', () => {
    expect(canonicalizeClaimCode(' abcd-efgh-jkmn ')).toBe('ABCDEFGHJKMN');
    expect(isValidClaimCode('ABCD-EFGH-JKMN')).toBe(true);
    expect(isValidClaimCode('ABCD-EFGI-JKMN')).toBe(false);
  });

  test('rejects invalid canonical values during formatting', () => {
    expect(() => formatClaimCode('short')).toThrow(/12 Crockford/);
  });

  test.each([
    ['01234567-89ab-4cde-8fab-0123456789ab', true],
    ['01234567-89AB-4cde-8fab-0123456789ab', false],
    ['01234567-89ab-3cde-8fab-0123456789ab', false],
  ])('validates lowercase UUID v4 values', (value, expected) => {
    expect(isLowercaseUuidV4(value)).toBe(expected);
  });

  test('enforces the locked ticket state machine', () => {
    expect(isAllowedTicketTransition('claimed', 'enrolled')).toBe(true);
    expect(isAllowedTicketTransition('enrolled', 'checked_in')).toBe(true);
    expect(isAllowedTicketTransition('enrolled', 'claimed')).toBe(false);
    expect(isAllowedTicketTransition('checked_in', 'revoked')).toBe(false);
    expect(isAllowedTicketTransition('cancelled', 'cancelled')).toBe(true);
  });
});
