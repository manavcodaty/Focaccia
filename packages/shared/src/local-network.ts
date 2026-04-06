const LOCAL_SUPABASE_PORT = '54321';
const DEFAULT_TIMEOUT_MS = 8000;
type RequestTarget = string | URL | { url: string };

function isPrivateIpv4Host(host: string): boolean {
  return /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}

function extractHost(hostUri?: string | null): string | null {
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
  } catch {
    return null;
  }
}

function describeRequestTarget(input: RequestTarget): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

export function resolveLocalSupabaseUrl({
  configuredUrl,
  expoHostUri,
}: {
  configuredUrl?: string;
  expoHostUri?: string | null;
}): string {
  const runtimeHost = extractHost(expoHostUri);

  if (configuredUrl) {
    const resolved = new URL(configuredUrl);

    if (
      runtimeHost
      && runtimeHost !== resolved.hostname
      && isPrivateIpv4Host(runtimeHost)
      && (isPrivateIpv4Host(resolved.hostname) || isLoopbackHost(resolved.hostname))
    ) {
      resolved.hostname = runtimeHost;
    }

    return resolved.origin;
  }

  if (!runtimeHost) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL for the mobile app, and no Expo host was available to infer it.',
    );
  }

  return `http://${runtimeHost}:${LOCAL_SUPABASE_PORT}`;
}

export async function fetchWithTimeout({
  errorPrefix,
  fetchImpl = fetch,
  init,
  input,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  errorPrefix: string;
  fetchImpl?: typeof fetch;
  init?: RequestInit;
  input: RequestTarget;
  timeoutMs?: number;
}): Promise<Response> {
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
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error instanceof TypeError)) {
      throw new Error(
        `${errorPrefix} Check EXPO_PUBLIC_SUPABASE_URL and confirm the local Supabase services are reachable at ${describeRequestTarget(input)}.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createTimeoutFetch({
  errorPrefix,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  errorPrefix: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): typeof fetch {
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
