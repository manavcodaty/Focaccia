"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocalSupabaseUrl = resolveLocalSupabaseUrl;
exports.fetchWithTimeout = fetchWithTimeout;
exports.createTimeoutFetch = createTimeoutFetch;
const DEFAULT_TIMEOUT_MS = 8000;
function describeRequestTarget(input) {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.toString();
    }
    return input.url;
}
function resolveLocalSupabaseUrl({ configuredUrl, }) {
    if (!configuredUrl) {
        throw new Error('Missing EXPO_PUBLIC_FOCACCIA_SUPABASE_URL. Network URLs are never inferred from Expo host metadata.');
    }
    return new URL(configuredUrl).origin;
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
            throw new Error(`${errorPrefix} Check EXPO_PUBLIC_FOCACCIA_SUPABASE_URL and confirm the selected Supabase service is reachable at ${describeRequestTarget(input)}.`);
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