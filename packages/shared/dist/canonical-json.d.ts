export type CanonicalJsonPrimitive = null | boolean | number | string;
export type CanonicalJsonValue = CanonicalJsonPrimitive | CanonicalJsonValue[] | {
    [key: string]: CanonicalJsonValue;
};
export declare function canonicalJsonStringify(value: CanonicalJsonValue): string;
export declare function canonicalJsonBytes(value: CanonicalJsonValue): Uint8Array;
//# sourceMappingURL=canonical-json.d.ts.map