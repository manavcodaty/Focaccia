"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocalSupabaseUrl = resolveLocalSupabaseUrl;
exports.fetchWithTimeout = fetchWithTimeout;
exports.createTimeoutFetch = createTimeoutFetch;
const LOCAL_SUPABASE_PORT = '54321';
const DEFAULT_TIMEOUT_MS = 8000;
function isPrivateIpv4Host(host) {
    return /^10\./.test(host)
        || /^192\.168\./.test(host)
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}
function isLoopbackHost(host) {
    return host === 'localhost' || host === '127.0.0.1';
}
function extractHost(hostUri) {
    if (!hostUri) {
        return null;
    }
    const trimmed = hostUri.trim();
    if (!trimmed) {
        return null;
    }
    const value = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
    try {
        return new URL(value).hostname;
    }
    catch {
        return null;
    }
}
function describeRequestTarget(input) {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.toString();
    }
    return input.url;
}
function resolveLocalSupabaseUrl({ configuredUrl, expoHostUri, }) {
    const runtimeHost = extractHost(expoHostUri);
    if (configuredUrl) {
        const resolved = new URL(configuredUrl);
        if (runtimeHost
            && runtimeHost !== resolved.hostname
            && isPrivateIpv4Host(runtimeHost)
            && (isPrivateIpv4Host(resolved.hostname) || isLoopbackHost(resolved.hostname))) {
            resolved.hostname = runtimeHost;
        }
        return resolved.origin;
    }
    if (!runtimeHost) {
        throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL for the mobile app, and no Expo host was available to infer it.');
    }
    return `http://${runtimeHost}:${LOCAL_SUPABASE_PORT}`;
}
async function fetchWithTimeout({ errorPrefix, fetchImpl = fetch, init, input, timeoutMs = DEFAULT_TIMEOUT_MS, }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    if (init?.signal) {
        init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
        const requestInput = typeof input === 'string' || input instanceof URL ? input : input.url;
        return await fetchImpl(requestInput, {
            ...init,
            signal: controller.signal,
        });
    }
    catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error instanceof TypeError)) {
            throw new Error(`${errorPrefix} Check EXPO_PUBLIC_SUPABASE_URL and confirm the local Supabase services are reachable at ${describeRequestTarget(input)}.`);
        }
        throw error;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
function createTimeoutFetch({ errorPrefix, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, }) {
    return (input, init) => {
        if (init === undefined) {
            return fetchWithTimeout({
                errorPrefix,
                fetchImpl,
                input,
                timeoutMs,
            });
        }
        return fetchWithTimeout({
            errorPrefix,
            fetchImpl,
            init,
            input,
            timeoutMs,
        });
    };
}
//# sourceMappingURL=local-network.js.map