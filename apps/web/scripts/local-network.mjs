import { networkInterfaces } from "node:os";

function isPrivateIpv4Host(host) {
  return /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

function isLoopbackHost(host) {
  return host === "localhost" || host === "127.0.0.1";
}

function isLocalDevelopmentHost(host) {
  return isPrivateIpv4Host(host) || isLoopbackHost(host);
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

export function resolveServerSupabaseUrl({ configuredUrl, requestHostname, serverHostname }) {
  const resolved = new URL(configuredUrl);

  if (
    requestHostname
    && requestHostname !== resolved.hostname
    && isLocalDevelopmentHost(requestHostname)
    && isLocalDevelopmentHost(resolved.hostname)
  ) {
    resolved.hostname = requestHostname;
    return resolved.origin;
  }

  if (
    serverHostname
    && serverHostname !== resolved.hostname
    && isPrivateIpv4Host(serverHostname)
    && isPrivateIpv4Host(resolved.hostname)
  ) {
    resolved.hostname = serverHostname;
  }

  return resolved.origin;
}
