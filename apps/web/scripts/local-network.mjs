import { networkInterfaces } from "node:os";

function isPrivateIpv4Host(host) {
  return /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

export function getCurrentServerHostname() {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return undefined;
}

export function resolveServerSupabaseUrl({ configuredUrl, serverHostname }) {
  if (!serverHostname) {
    return configuredUrl;
  }

  const resolved = new URL(configuredUrl);

  if (
    serverHostname !== resolved.hostname
    && isPrivateIpv4Host(serverHostname)
    && isPrivateIpv4Host(resolved.hostname)
  ) {
    resolved.hostname = serverHostname;
  }

  return resolved.origin;
}
