"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAIM_CODE_ALPHABET = void 0;
exports.canonicalizeClaimCode = canonicalizeClaimCode;
exports.formatClaimCode = formatClaimCode;
exports.claimCodeFromEntropy = claimCodeFromEntropy;
exports.isValidClaimCode = isValidClaimCode;
exports.isLowercaseUuidV4 = isLowercaseUuidV4;
exports.isAllowedTicketTransition = isAllowedTicketTransition;
exports.CLAIM_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CLAIM_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{12}$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function canonicalizeClaimCode(value) {
    return value.replace(/-/g, '').trim().toUpperCase();
}
function formatClaimCode(canonical) {
    if (!CLAIM_CODE_PATTERN.test(canonical)) {
        throw new TypeError('Claim code must contain exactly 12 Crockford Base32 characters.');
    }
    return `${canonical.slice(0, 4)}-${canonical.slice(4, 8)}-${canonical.slice(8, 12)}`;
}
function claimCodeFromEntropy(entropy) {
    if (entropy.length !== 8) {
        throw new RangeError('Claim-code entropy must contain exactly 8 bytes.');
    }
    let value = BigInt(0);
    for (const byte of entropy)
        value = (value << BigInt(8)) | BigInt(byte);
    value &= (BigInt(1) << BigInt(60)) - BigInt(1);
    let canonical = '';
    for (let index = 0; index < 12; index += 1) {
        canonical = exports.CLAIM_CODE_ALPHABET[Number(value & BigInt(31))] + canonical;
        value >>= BigInt(5);
    }
    return formatClaimCode(canonical);
}
function isValidClaimCode(value) {
    return CLAIM_CODE_PATTERN.test(canonicalizeClaimCode(value));
}
function isLowercaseUuidV4(value) {
    return UUID_V4_PATTERN.test(value);
}
function isAllowedTicketTransition(from, to) {
    if (from === to)
        return true;
    if (from === 'claimed')
        return ['enrolled', 'cancelled', 'revoked'].includes(to);
    if (from === 'enrolled')
        return ['checked_in', 'cancelled', 'revoked'].includes(to);
    return false;
}
//# sourceMappingURL=ticketing.js.map