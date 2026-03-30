"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalJsonStringify = canonicalJsonStringify;
exports.canonicalJsonBytes = canonicalJsonBytes;
const textEncoder = new TextEncoder();
function isPlainJsonObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function serializeValue(value) {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError('Canonical JSON does not allow non-finite numbers.');
        }
        return JSON.stringify(value);
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => serializeValue(item)).join(',')}]`;
    }
    if (!isPlainJsonObject(value)) {
        throw new TypeError('Canonical JSON only supports plain objects.');
    }
    const sortedKeys = Object.keys(value).sort();
    const serializedEntries = sortedKeys.map((key) => {
        const entry = value[key];
        if (entry === undefined) {
            throw new TypeError('Canonical JSON does not allow undefined values.');
        }
        return `${JSON.stringify(key)}:${serializeValue(entry)}`;
    });
    return `{${serializedEntries.join(',')}}`;
}
function canonicalJsonStringify(value) {
    return serializeValue(value);
}
function canonicalJsonBytes(value) {
    return textEncoder.encode(canonicalJsonStringify(value));
}
//# sourceMappingURL=canonical-json.js.map