/** Runtime configuration for fixture-only cloud builds; production never fetches it. */
export async function loadCloudProvisioning({
  enabled, encodedPayload, contextUrl, signal, readLocalPayload, fetchImpl = fetch,
}: {
  enabled: boolean;
  encodedPayload?: string | undefined;
  contextUrl?: string | undefined;
  signal?: AbortSignal | undefined;
  readLocalPayload?: (() => Promise<string | null>) | undefined;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  if (!enabled) return null;
  if (encodedPayload) return decodeURIComponent(encodedPayload);
  if (readLocalPayload) {
    const local = await readLocalPayload();
    if (local) return local;
  }
  if (!contextUrl) throw new Error('Cloud provisioning fixture is missing.');
  const url = new URL(contextUrl);
  const octets = url.hostname.split('.');
  const privateHost = octets.length === 4 && octets.every((v) => /^\d+$/.test(v) && Number(v) <= 255) && /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname);
  if (url.protocol !== 'http:' || !privateHost || url.port !== '9012' || url.pathname !== '/provisioning' || url.username || url.password || url.search || url.hash) {
    throw new Error('Cloud provisioning must use the runner-local fixture endpoint.');
  }
  const response = await fetchImpl(url.toString(), { ...(signal ? { signal } : {}), cache: 'no-store' });
  if (!response.ok) throw new Error('Cloud provisioning context is not ready.');
  return JSON.stringify(await response.json());
}
