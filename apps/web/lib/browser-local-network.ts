export function resolveBrowserSupabaseUrl({
  configuredUrl,
}: {
  browserHostname?: string;
  configuredUrl: string;
}): string {
  return new URL(configuredUrl).origin;
}
