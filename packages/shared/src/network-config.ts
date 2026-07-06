export type NetworkMode = 'local' | 'tunnel';

export interface NetworkConfig {
  readonly browserOrigins: readonly string[];
  readonly diagnosticLabel: 'Local network' | 'Tunnel';
  readonly localHost?: string;
  readonly mode: NetworkMode;
  readonly supabaseUrl: string;
  readonly ticketsUrl: string;
  readonly webUrl: string;
}

export interface PublicNetworkConfig extends NetworkConfig {
  readonly anonKey: string;
}

type Environment = Readonly<Record<string, string | undefined>>;
type PublicPrefix = 'EXPO_PUBLIC_' | 'NEXT_PUBLIC_';

const PRIVATE_IPV4_PATTERN = /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})$/;
const PLACEHOLDER_PATTERN = /(?:<[^>]+>|your[-_. ]|replace[-_. ]|example\.invalid|project-ref|change[-_. ]me)/i;

export class NetworkConfigError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'NetworkConfigError';
  }
}

function requireValue(env: Environment, name: string, mode: NetworkMode): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new NetworkConfigError(
      'missing_network_value',
      `${name} is required for ${mode} mode.`,
    );
  }

  if (PLACEHOLDER_PATTERN.test(value)) {
    throw new NetworkConfigError(
      'placeholder_network_value',
      `${name} still contains a placeholder value.`,
    );
  }

  return value;
}

function parseMode(value: string | undefined): NetworkMode {
  if (value !== 'local' && value !== 'tunnel') {
    throw new NetworkConfigError(
      'invalid_network_mode',
      'FOCACCIA_NETWORK_MODE must be exactly local or tunnel.',
    );
  }

  return value;
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isPrivateIpv4Host(host: string): boolean {
  if (!PRIVATE_IPV4_PATTERN.test(host)) {
    return false;
  }

  return host.split('.').every((part) => {
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255;
  });
}

function parseUrl(
  raw: string,
  name: string,
  mode: NetworkMode,
  localHost?: string,
): string {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new NetworkConfigError('malformed_network_url', `${name} must be a valid absolute URL.`);
  }

  if (
    parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== '' && parsed.pathname !== '/')
  ) {
    throw new NetworkConfigError(
      'invalid_network_url_shape',
      `${name} must be an origin URL without credentials, path, query, or fragment.`,
    );
  }

  if (PLACEHOLDER_PATTERN.test(parsed.hostname)) {
    throw new NetworkConfigError('placeholder_network_url', `${name} contains a placeholder host.`);
  }

  if (mode === 'local') {
    if (parsed.protocol !== 'http:') {
      throw new NetworkConfigError('invalid_local_protocol', `${name} must use HTTP in local mode.`);
    }

    if (!localHost || parsed.hostname !== localHost) {
      throw new NetworkConfigError(
        'mixed_local_origin',
        `${name} must use the configured FOCACCIA_LOCAL_HOST in local mode.`,
      );
    }
  } else {
    if (parsed.protocol !== 'https:') {
      throw new NetworkConfigError('invalid_tunnel_protocol', `${name} must use HTTPS in tunnel mode.`);
    }

    if (isLoopbackHost(parsed.hostname) || isPrivateIpv4Host(parsed.hostname)) {
      throw new NetworkConfigError(
        'mixed_tunnel_origin',
        `${name} must not use a loopback or private-network host in tunnel mode.`,
      );
    }
  }

  return parsed.origin;
}

function localBrowserOriginAliases(): readonly string[] {
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];
}

function buildBrowserOrigins(mode: NetworkMode, webUrl: string, ticketsUrl: string): readonly string[] {
  return Array.from(new Set([
    webUrl,
    ticketsUrl,
    ...(mode === 'local' ? localBrowserOriginAliases() : []),
  ]));
}

function parseSelectedNetworkConfig({
  localHostValue,
  modeValue,
  supabaseUrlValue,
  ticketsUrlValue,
  valueNames,
  webUrlValue,
}: {
  localHostValue: string | undefined;
  modeValue: string | undefined;
  supabaseUrlValue: string | undefined;
  ticketsUrlValue: string | undefined;
  valueNames: {
    localHost: string;
    mode: string;
    supabaseUrl: string;
    ticketsUrl: string;
    webUrl: string;
  };
  webUrlValue: string | undefined;
}): NetworkConfig {
  const mode = parseMode(modeValue);
  let localHost: string | undefined;

  if (mode === 'local') {
    localHost = localHostValue?.trim();

    if (!localHost || !isPrivateIpv4Host(localHost) || isLoopbackHost(localHost)) {
      throw new NetworkConfigError(
        'invalid_local_host',
        `${valueNames.localHost} must be a stable private LAN IPv4 address for physical-device local mode.`,
      );
    }
  }

  const selectedEnv: Environment = {
    [valueNames.supabaseUrl]: supabaseUrlValue,
    [valueNames.ticketsUrl]: ticketsUrlValue,
    [valueNames.webUrl]: webUrlValue,
  };
  const supabaseUrl = parseUrl(
    requireValue(selectedEnv, valueNames.supabaseUrl, mode),
    valueNames.supabaseUrl,
    mode,
    localHost,
  );
  const webUrl = parseUrl(
    requireValue(selectedEnv, valueNames.webUrl, mode),
    valueNames.webUrl,
    mode,
    localHost,
  );
  const ticketsUrl = parseUrl(
    requireValue(selectedEnv, valueNames.ticketsUrl, mode),
    valueNames.ticketsUrl,
    mode,
    localHost,
  );

  if (mode === 'local') {
    const supabasePort = new URL(supabaseUrl).port;

    if (supabasePort !== '54331') {
      throw new NetworkConfigError(
        'invalid_local_supabase_port',
        `${valueNames.supabaseUrl} must use the constrained proxy port 54331.`,
      );
    }

    if (new URL(webUrl).port !== '3000' || new URL(ticketsUrl).port !== '3001') {
      throw new NetworkConfigError(
        'invalid_local_app_port',
        'Local web and tickets URLs must use ports 3000 and 3001 respectively.',
      );
    }
  }

  const config = {
    browserOrigins: buildBrowserOrigins(mode, webUrl, ticketsUrl),
    diagnosticLabel: mode === 'local' ? 'Local network' : 'Tunnel',
    mode,
    supabaseUrl,
    ticketsUrl,
    webUrl,
  } as const;

  return localHost ? { ...config, localHost } : config;
}

export function parseRootNetworkConfig(env: Environment): NetworkConfig {
  const mode = parseMode(env['FOCACCIA_NETWORK_MODE']?.trim());
  const prefix = mode === 'local' ? 'FOCACCIA_LOCAL_' : 'FOCACCIA_TUNNEL_';

  return parseSelectedNetworkConfig({
    localHostValue: env['FOCACCIA_LOCAL_HOST'],
    modeValue: mode,
    supabaseUrlValue: env[`${prefix}SUPABASE_URL`],
    ticketsUrlValue: env[`${prefix}TICKETS_URL`],
    valueNames: {
      localHost: 'FOCACCIA_LOCAL_HOST',
      mode: 'FOCACCIA_NETWORK_MODE',
      supabaseUrl: `${prefix}SUPABASE_URL`,
      ticketsUrl: `${prefix}TICKETS_URL`,
      webUrl: `${prefix}WEB_URL`,
    },
    webUrlValue: env[`${prefix}WEB_URL`],
  });
}

export function parsePublicNetworkConfig(
  env: Environment,
  prefix: PublicPrefix,
): PublicNetworkConfig {
  const network = parseSelectedNetworkConfig({
    localHostValue: env[`${prefix}FOCACCIA_LOCAL_HOST`],
    modeValue: env[`${prefix}FOCACCIA_NETWORK_MODE`],
    supabaseUrlValue: env[`${prefix}FOCACCIA_SUPABASE_URL`],
    ticketsUrlValue: env[`${prefix}FOCACCIA_TICKETS_URL`],
    valueNames: {
      localHost: `${prefix}FOCACCIA_LOCAL_HOST`,
      mode: `${prefix}FOCACCIA_NETWORK_MODE`,
      supabaseUrl: `${prefix}FOCACCIA_SUPABASE_URL`,
      ticketsUrl: `${prefix}FOCACCIA_TICKETS_URL`,
      webUrl: `${prefix}FOCACCIA_WEB_URL`,
    },
    webUrlValue: env[`${prefix}FOCACCIA_WEB_URL`],
  });
  const anonKeyName = `${prefix}SUPABASE_ANON_KEY`;
  const anonKey = env[anonKeyName]?.trim();

  if (!anonKey) {
    throw new NetworkConfigError('missing_anon_key', `${anonKeyName} is required.`);
  }

  return {
    ...network,
    anonKey,
  };
}
