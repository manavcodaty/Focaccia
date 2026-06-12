const DEFAULT_TIMEOUT_MS = 8000;
type RequestTarget = string | URL | { url: string };

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
}: {
  configuredUrl?: string;
  expoHostUri?: string | null;
}): string {
  if (!configuredUrl) {
    throw new Error(
      'Missing EXPO_PUBLIC_FOCACCIA_SUPABASE_URL. Network URLs are never inferred from Expo host metadata.',
    );
  }

  return new URL(configuredUrl).origin;
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
        `${errorPrefix} Check EXPO_PUBLIC_FOCACCIA_SUPABASE_URL and confirm the selected Supabase service is reachable at ${describeRequestTarget(input)}.`,
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
