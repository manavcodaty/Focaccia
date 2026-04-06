function isPrivateIpv4Host(host: string): boolean {
  return /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1";
}

export function resolveBrowserSupabaseUrl({
  browserHostname,
  configuredUrl,
}: {
  browserHostname?: string;
  configuredUrl: string;
}): string {
  if (!browserHostname) {
    return configuredUrl;
  }

  const resolved = new URL(configuredUrl);

  if (
    browserHostname !== resolved.hostname
    && (isPrivateIpv4Host(browserHostname) || isLoopbackHost(browserHostname))
    && (isPrivateIpv4Host(resolved.hostname) || isLoopbackHost(resolved.hostname))
  ) {
    resolved.hostname = browserHostname;
  }

  return resolved.origin;
}
