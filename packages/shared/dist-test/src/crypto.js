"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareCrypto = prepareCrypto;
exports.blake2b = blake2b;
exports.canonicalJsonSignature = canonicalJsonSignature;
exports.ed25519Keypair = ed25519Keypair;
exports.ed25519KeypairFromSeed = ed25519KeypairFromSeed;
exports.ed25519SignDetached = ed25519SignDetached;
exports.ed25519VerifyDetached = ed25519VerifyDetached;
exports.x25519Keypair = x25519Keypair;
exports.x25519Seal = x25519Seal;
exports.x25519SealOpen = x25519SealOpen;
exports.toBase64Url = toBase64Url;
exports.fromBase64Url = fromBase64Url;
const canonical_json_1 = require("./canonical-json");
const sodium_1 = require("./sodium");
function toEd25519KeyPair(keyPair) {
    if (keyPair.keyType !== 'ed25519') {
        throw new TypeError(`Expected an Ed25519 keypair, received ${keyPair.keyType}.`);
    }
    return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        keyType: 'ed25519',
    };
}
function toX25519KeyPair(keyPair) {
    if (keyPair.keyType !== 'x25519') {
        throw new TypeError(`Expected an X25519 keypair, received ${keyPair.keyType}.`);
    }
    return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        keyType: 'x25519',
    };
}
function assertSeedLength(seed) {
    if (seed.length !== 32) {
        throw new RangeError('Ed25519 seed must be exactly 32 bytes.');
    }
}
async function prepareCrypto() {
    await (0, sodium_1.getSodium)();
}
async function blake2b(message, outputLength = 64) {
    if (outputLength < 1 || outputLength > 64) {
        throw new RangeError('BLAKE2b output length must be between 1 and 64 bytes.');
    }
    const sodium = await (0, sodium_1.getSodium)();
    return sodium.crypto_generichash(outputLength, message, null);
}
async function canonicalJsonSignature(payload, privateKey) {
    return ed25519SignDetached((0, canonical_json_1.canonicalJsonBytes)(payload), privateKey);
}
async function ed25519Keypair() {
    const sodium = await (0, sodium_1.getSodium)();
    return toEd25519KeyPair(sodium.crypto_sign_keypair());
}
async function ed25519KeypairFromSeed(seed) {
    assertSeedLength(seed);
    const sodium = await (0, sodium_1.getSodium)();
    return toEd25519KeyPair(sodium.crypto_sign_seed_keypair(seed));
}
async function ed25519SignDetached(message, privateKey) {
    const sodium = await (0, sodium_1.getSodium)();
    return sodium.crypto_sign_detached(message, privateKey);
}
async function ed25519VerifyDetached(signature, message, publicKey) {
    const sodium = await (0, sodium_1.getSodium)();
    return sodium.crypto_sign_verify_detached(signature, message, publicKey);
}
async function x25519Keypair() {
    const sodium = await (0, sodium_1.getSodium)();
    return toX25519KeyPair(sodium.crypto_box_keypair());
}
async function x25519Seal(message, publicKey) {
    const sodium = await (0, sodium_1.getSodium)();
    return sodium.crypto_box_seal(message, publicKey);
}
async function x25519SealOpen(ciphertext, publicKey, privateKey) {
    const sodium = await (0, sodium_1.getSodium)();
    return sodium.crypto_box_seal_open(ciphertext, publicKey, privateKey);
}
async function toBase64Url(value) {
    const sodium = await (0, sodium_1.getSodium)();
    return sodium.to_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}
async function fromBase64Url(value) {
    const sodium = await (0, sodium_1.getSodium)();
    return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}
//# sourceMappingURL=crypto.js.map