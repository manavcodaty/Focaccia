"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
function createFakeEmbedding() {
    return Float32Array.from({ length: 128 }, (_, index) => {
        const position = index + 1;
        return Math.sin(position / 5) * 0.7 + Math.cos(position / 13) * 0.3;
    });
}
function scaleEmbedding(embedding, factor) {
    return Float32Array.from(embedding, (value) => value * factor);
}
function mutateEmbedding(embedding) {
    return Float32Array.from(embedding, (value, index) => index % 11 === 0 ? value * -0.5 : value + 0.03125);
}
function fixedSalt(offset) {
    return Uint8Array.from({ length: 32 }, (_, index) => (index * 17 + offset) & 0xff);
}
function fixedSeed(offset) {
    return Uint8Array.from({ length: 32 }, (_, index) => (index * 13 + offset) & 0xff);
}
function toHex(value) {
    return Buffer.from(value).toString('hex');
}
describe('shared crypto package', () => {
    beforeAll(async () => {
        await (0, src_1.prepareCrypto)();
    });
    it('canonicalJsonStringify sorts keys recursively and removes whitespace', () => {
        const payload = {
            z: 1,
            a: {
                b: true,
                a: [2, { z: null, a: 'x' }],
            },
            m: 'face-pass',
        };
        expect((0, src_1.canonicalJsonStringify)(payload)).toBe('{"a":{"a":[2,{"a":"x","z":null}],"b":true},"m":"face-pass","z":1}');
    });
    it('canonicalJsonBytes matches UTF-8 serialization', () => {
        const payload = {
            event_id: 'evt_test',
            single_use: true,
            v: 1,
        };
        expect(Buffer.from((0, src_1.canonicalJsonBytes)(payload)).toString('utf8')).toBe((0, src_1.canonicalJsonStringify)(payload));
    });
    it('cancelableTemplateV1 is deterministic for the same embedding and salt', async () => {
        const embedding = createFakeEmbedding();
        const salt = fixedSalt(29);
        const first = await (0, src_1.cancelableTemplateV1)(embedding, salt);
        const second = await (0, src_1.cancelableTemplateV1)(embedding, salt);
        expect(first).toHaveLength(32);
        expect(toHex(first)).toBe(toHex(second));
    });
    it('cancelableTemplateV1 is invariant to scalar multiplication because of L2 normalization', async () => {
        const embedding = createFakeEmbedding();
        const salt = fixedSalt(47);
        const normalized = await (0, src_1.cancelableTemplateV1)(embedding, salt);
        const scaled = await (0, src_1.cancelableTemplateV1)(scaleEmbedding(embedding, 7.5), salt);
        expect(toHex(normalized)).toBe(toHex(scaled));
    });
    it('cancelableTemplateV1 changes when the event salt or embedding changes', async () => {
        const embedding = createFakeEmbedding();
        const differentEmbedding = mutateEmbedding(embedding);
        const salt = fixedSalt(61);
        const differentSalt = fixedSalt(97);
        const baseline = await (0, src_1.cancelableTemplateV1)(embedding, salt);
        const changedSalt = await (0, src_1.cancelableTemplateV1)(embedding, differentSalt);
        const changedEmbedding = await (0, src_1.cancelableTemplateV1)(differentEmbedding, salt);
        expect((0, src_1.hammingDistance)(baseline, changedSalt)).toBeGreaterThan(0);
        expect((0, src_1.hammingDistance)(baseline, changedEmbedding)).toBeGreaterThan(0);
    });
    it('hammingDistance counts differing bits correctly and is symmetric', () => {
        const zeros = new Uint8Array(32);
        const ones = new Uint8Array(32).fill(0xff);
        const sampleA = Uint8Array.from([0x0f, 0xf0, 0xaa, 0x55]);
        const sampleB = Uint8Array.from([0x00, 0xff, 0xaa, 0x00]);
        expect((0, src_1.hammingDistance)(zeros, zeros)).toBe(0);
        expect((0, src_1.hammingDistance)(zeros, ones)).toBe(256);
        expect((0, src_1.hammingDistance)(sampleA, sampleB)).toBe(12);
        expect((0, src_1.hammingDistance)(sampleA, sampleB)).toBe((0, src_1.hammingDistance)(sampleB, sampleA));
    });
    it('Ed25519 signatures verify for canonical JSON and fail on tampering', async () => {
        const payload = {
            enc_template: 'abc123',
            event_id: 'evt_signing',
            exp: 1712000000,
            iat: 1711990000,
            nonce: 'nonce',
            pass_id: 'pass',
            single_use: true,
            v: 1,
        };
        const keypair = await (0, src_1.ed25519KeypairFromSeed)(fixedSeed(7));
        const payloadBytes = (0, src_1.canonicalJsonBytes)(payload);
        const signature = await (0, src_1.canonicalJsonSignature)(payload, keypair.privateKey);
        const tamperedPayloadBytes = (0, src_1.canonicalJsonBytes)({ ...payload, nonce: 'tampered' });
        expect(await (0, src_1.ed25519VerifyDetached)(signature, payloadBytes, keypair.publicKey)).toBe(true);
        expect(await (0, src_1.ed25519VerifyDetached)(signature, tamperedPayloadBytes, keypair.publicKey)).toBe(false);
    });
    it('X25519 sealed boxes decrypt back to the original payload', async () => {
        const keypair = await (0, src_1.x25519Keypair)();
        const message = (0, src_1.canonicalJsonBytes)({
            event_id: 'evt_encrypt',
            pass_id: 'pass_encrypt',
            single_use: true,
            v: 1,
        });
        const ciphertext = await (0, src_1.x25519Seal)(message, keypair.publicKey);
        const plaintext = await (0, src_1.x25519SealOpen)(ciphertext, keypair.publicKey, keypair.privateKey);
        expect(Buffer.from(plaintext).toString('utf8')).toBe(Buffer.from(message).toString('utf8'));
    });
    it('base64url helpers round-trip binary values', async () => {
        const digest = await (0, src_1.blake2b)((0, src_1.canonicalJsonBytes)({ event_id: 'evt_b64', v: 1 }));
        const encoded = await (0, src_1.toBase64Url)(digest);
        const decoded = await (0, src_1.fromBase64Url)(encoded);
        expect(toHex(decoded)).toBe(toHex(digest));
    });
});
//# sourceMappingURL=crypto.test.js.map