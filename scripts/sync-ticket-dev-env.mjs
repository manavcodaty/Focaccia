import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIVATE_IPV4_PATTERN = /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})$/;
const LOCAL_SUPABASE_PROXY_PORT = '54331';
const WEB_PORT = '3000';
const TICKETS_PORT = '3001';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, '..');

function isIpv4(value) {
  return value === 'IPv4' || value === 4;
}

function isPrivateIpv4(address) {
  return PRIVATE_IPV4_PATTERN.test(address)
    && address.split('.').every((part) => {
      const value = Number(part);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
}

function activePrivateIps(interfaces) {
  return Object.entries(interfaces)
    .flatMap(([name, values]) => (values ?? []).map((value) => ({ ...value, name })))
    .filter((value) => isIpv4(value.family) && !value.internal && isPrivateIpv4(value.address))
    .sort((left, right) => interfaceRank(left.name) - interfaceRank(right.name))
    .map((value) => value.address);
}

function interfaceRank(name) {
  if (name === 'en0') return 0;
  if (name?.startsWith('en')) return 1;
  if (name?.startsWith('bridge')) return 3;
  if (name?.startsWith('utun')) return 4;
  return 2;
}

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return [];
    }

    const separator = trimmed.indexOf('=');

    if (separator < 1) {
      return [];
    }

    return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim()]];
  }));
}

function upsertEnv(text, updates) {
  const remainingUpdates = { ...updates };
  const lines = text.split(/\r?\n/).filter((line, index, all) => index < all.length - 1 || line !== '');
  const updatedLines = lines.map((line) => {
    const separator = line.indexOf('=');
    const key = separator > 0 ? line.slice(0, separator).trim() : null;

    if (!key || !Object.hasOwn(remainingUpdates, key)) {
      return line;
    }

    const value = remainingUpdates[key];
    delete remainingUpdates[key];
    return `${key}=${value}`;
  });

  return `${[
    ...updatedLines,
    ...Object.entries(remainingUpdates).map(([key, value]) => `${key}=${value}`),
  ].join('\n')}\n`;
}

function readEnvFile(envPath, fallback = '') {
  return existsSync(envPath) ? readFileSync(envPath, 'utf8') : fallback;
}

function writeEnvFile(envPath, text) {
  mkdirSync(path.dirname(envPath), { recursive: true });
  writeFileSync(envPath, text, { encoding: 'utf8', mode: 0o600 });
  chmodSync(envPath, 0o600);
}

function publicEnvUpdates(prefix, host, sourceEnv) {
  const anonKey = sourceEnv[`${prefix}SUPABASE_ANON_KEY`];

  return {
    [`${prefix}FOCACCIA_LOCAL_HOST`]: host,
    [`${prefix}FOCACCIA_NETWORK_MODE`]: 'local',
    [`${prefix}FOCACCIA_SUPABASE_URL`]: `http://${host}:${LOCAL_SUPABASE_PROXY_PORT}`,
    [`${prefix}FOCACCIA_TICKETS_URL`]: `http://${host}:${TICKETS_PORT}`,
    [`${prefix}FOCACCIA_WEB_URL`]: `http://${host}:${WEB_PORT}`,
    ...(anonKey ? { [`${prefix}SUPABASE_ANON_KEY`]: anonKey } : {}),
  };
}

function functionsEnvUpdates(host) {
  return {
    FOCACCIA_LOCAL_HOST: host,
    FOCACCIA_LOCAL_SUPABASE_URL: `http://${host}:${LOCAL_SUPABASE_PROXY_PORT}`,
    FOCACCIA_LOCAL_TICKETS_URL: `http://${host}:${TICKETS_PORT}`,
    FOCACCIA_LOCAL_WEB_URL: `http://${host}:${WEB_PORT}`,
    FOCACCIA_NETWORK_MODE: 'local',
  };
}

export function syncTicketDevEnv({
  getNetworkInterfaces = networkInterfaces,
  logger = console,
  repoRoot = defaultRepoRoot,
} = {}) {
  const host = activePrivateIps(getNetworkInterfaces())[0];

  if (!host) {
    throw new Error('No active private IPv4 address found for ticket dev networking.');
  }

  const targets = [
    {
      envPath: path.join(repoRoot, '.env.local'),
      updates() {
        return functionsEnvUpdates(host);
      },
    },
    {
      envPath: path.join(repoRoot, 'apps/enrollment/.env.local'),
      updates(currentEnv) {
        return publicEnvUpdates('EXPO_PUBLIC_', host, currentEnv);
      },
    },
    {
      envPath: path.join(repoRoot, 'apps/tickets/.env.local'),
      updates(currentEnv) {
        return publicEnvUpdates('NEXT_PUBLIC_', host, currentEnv);
      },
    },
    {
      envPath: path.join(repoRoot, 'apps/web/.env.local'),
      updates(currentEnv) {
        return publicEnvUpdates('NEXT_PUBLIC_', host, currentEnv);
      },
    },
    {
      envPath: path.join(repoRoot, 'supabase/functions/.env.local'),
      updates() {
        return functionsEnvUpdates(host);
      },
    },
    {
      createIfMissing: false,
      envPath: path.join(repoRoot, 'supabase/functions/.env'),
      updates() {
        return functionsEnvUpdates(host);
      },
    },
  ];

  for (const target of targets) {
    if (target.createIfMissing === false && !existsSync(target.envPath)) {
      continue;
    }

    const currentText = readEnvFile(target.envPath);
    const currentEnv = parseEnv(currentText);
    const updatedText = upsertEnv(
      currentText,
      target.updates(currentEnv),
    );

    writeEnvFile(target.envPath, updatedText);
  }

  logger.log(`[Ticket Dev Env] Synced enrollment, tickets, organizer, and function local URLs to ${host}.`);
  return { host };
}

if (process.argv[1] === __filename) {
  syncTicketDevEnv();
}
