type RequestTarget = string | URL | {
    url: string;
};
export declare function resolveLocalSupabaseUrl({ configuredUrl, expoHostUri, }: {
    configuredUrl?: string;
    expoHostUri?: string | null;
}): string;
export declare function fetchWithTimeout({ errorPrefix, fetchImpl, init, input, timeoutMs, }: {
    errorPrefix: string;
    fetchImpl?: typeof fetch;
    init?: RequestInit;
    input: RequestTarget;
    timeoutMs?: number;
}): Promise<Response>;
export declare function createTimeoutFetch({ errorPrefix, fetchImpl, timeoutMs, }: {
    errorPrefix: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}): typeof fetch;
export {};
//# sourceMappingURL=local-network.d.ts.map