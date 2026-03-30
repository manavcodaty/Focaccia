import type { CanonicalJsonValue } from './canonical-json';
export interface Ed25519KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
    keyType: 'ed25519';
}
export interface X25519KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
    keyType: 'x25519';
}
export declare function prepareCrypto(): Promise<void>;
export declare function blake2b(message: Uint8Array, outputLength?: number): Promise<Uint8Array>;
export declare function canonicalJsonSignature(payload: CanonicalJsonValue, privateKey: Uint8Array): Promise<Uint8Array>;
export declare function ed25519Keypair(): Promise<Ed25519KeyPair>;
export declare function ed25519KeypairFromSeed(seed: Uint8Array): Promise<Ed25519KeyPair>;
export declare function ed25519SignDetached(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
export declare function ed25519VerifyDetached(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
export declare function x25519Keypair(): Promise<X25519KeyPair>;
export declare function x25519Seal(message: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array>;
export declare function x25519SealOpen(ciphertext: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
export declare function toBase64Url(value: Uint8Array): Promise<string>;
export declare function fromBase64Url(value: string): Promise<Uint8Array>;
//# sourceMappingURL=crypto.d.ts.map