export function resolveServerSupabaseUrl({
  configuredUrl,
}: {
  configuredUrl: string;
  requestHostname?: string;
  serverHostname?: string;
}): string {
  return new URL(configuredUrl).origin;
}
