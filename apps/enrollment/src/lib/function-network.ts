import {
  fetchWithTimeout as sharedFetchWithTimeout,
  resolveLocalSupabaseUrl,
} from '@face-pass/shared';

export { resolveLocalSupabaseUrl as resolveSupabaseUrl };

export function fetchWithTimeout({
  errorPrefix,
  fetchImpl,
  init,
  timeoutMs,
  url,
}: {
  errorPrefix: string;
  fetchImpl?: typeof fetch;
  init?: RequestInit;
  timeoutMs?: number;
  url: string;
}): Promise<Response> {
  const options: {
    errorPrefix: string;
    fetchImpl?: typeof fetch;
    init?: RequestInit;
    input: string;
    timeoutMs?: number;
  } = {
    errorPrefix,
    input: url,
  };

  if (fetchImpl !== undefined) {
    options.fetchImpl = fetchImpl;
  }

  if (init !== undefined) {
    options.init = init;
  }

  if (timeoutMs !== undefined) {
    options.timeoutMs = timeoutMs;
  }

  return sharedFetchWithTimeout(options);
}
