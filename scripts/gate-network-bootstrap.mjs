import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

import { syncTicketDevEnv } from './sync-ticket-dev-env.mjs';

const LAN_PROXY_PORT = 54331;
const PROXY_START_TIMEOUT_MS = 5_000;
const PROXY_POLL_INTERVAL_MS = 100;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);
const NATIVE_APP_NAMES = new Set(['enrollment', 'gate']);
const PUBLIC_ENV_PREFIX = 'EXPO_PUBLIC_';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const separator = trimmed.indexOf('=');
    if (separator < 1) return [];
    return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim()]];
  }));
}

function nativeEnvPath(repoRoot, appName) {
  if (!NATIVE_APP_NAMES.has(appName)) {
    throw new Error(`Unsupported native app: ${appName}.`);
  }
  return path.join(repoRoot, 'apps', appName, '.env.local');
}

function readNativeEnv(repoRoot, appName) {
  const envPath = nativeEnvPath(repoRoot, appName);
  if (!existsSync(envPath)) {
    throw new Error(`Missing apps/${appName}/.env.local. Run pnpm demo:local or pnpm demo:tunnel first.`);
  }
  return parseEnv(readFileSync(envPath, 'utf8'));
}

function applyPublicEnv(values, runtimeEnv) {
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith(PUBLIC_ENV_PREFIX)) runtimeEnv[key] = value;
  }
}

function selectedMode(values) {
  const mode = values.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE;
  if (mode !== 'local' && mode !== 'tunnel') {
    throw new Error('apps/gate/.env.local must select EXPO_PUBLIC_FOCACCIA_NETWORK_MODE=local|tunnel.');
  }
  return mode;
}

export function parseSupabaseApiEndpoint(statusText) {
  const rawUrl = statusText.match(/^API_URL=["']?([^"'\r\n]+)["']?$/m)?.[1];
  if (!rawUrl) throw new Error('Supabase status did not report API_URL.');

  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('The local Supabase API endpoint must use an HTTP loopback host.');
  }

  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('The local Supabase API endpoint must include a valid port.');
  }

  return { host: url.hostname, port };
}

export function shouldPrepareGateNetwork(argv = process.argv) {
  return argv.includes('run:ios');
}

export const shouldPrepareNativeNetwork = shouldPrepareGateNetwork;

function defaultGetSupabaseStatus(repoRoot) {
  const result = spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10_000,
  });

  if (result.error || result.status !== 0) {
    throw new Error('Unable to read the running local Supabase API endpoint. Start Supabase first.');
  }

  return result.stdout;
}

function canConnect(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function proxyRequestHealthy({ host, marker = false, path, port, timeoutMs = 500 }) {
  return new Promise((resolve) => {
    const request = http.get({ host, path, port }, (response) => {
      response.resume();
      resolve(
        response.statusCode === 200
        && (!marker || response.headers['x-focaccia-proxy'] === '1'),
      );
    });
    request.setTimeout(timeoutMs, () => request.destroy());
    request.once('error', () => resolve(false));
  });
}

async function proxyHealthy(host, port, timeoutMs = 500) {
  return await proxyRequestHealthy({
    host,
    marker: true,
    path: '/.focaccia/health',
    port,
    timeoutMs,
  }) && await proxyRequestHealthy({
    host,
    path: '/auth/v1/health',
    port,
    timeoutMs,
  });
}

function allowedBrowserOrigins(host) {
  return [host, 'localhost', '127.0.0.1', '0.0.0.0'].flatMap((originHost) => [
    `http://${originHost}:3000`,
    `http://${originHost}:3001`,
  ]);
}

function defaultStartProxy({ host, repoRoot, upstreamHost, upstreamPort }) {
  return spawn(process.execPath, ['scripts/lan-supabase-proxy.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FOCACCIA_ALLOWED_BROWSER_ORIGINS: allowedBrowserOrigins(host).join(','),
      FOCACCIA_LAN_PROXY_PORT: String(LAN_PROXY_PORT),
      FOCACCIA_LOCAL_HOST: host,
      FOCACCIA_SUPABASE_UPSTREAM_HOST: upstreamHost,
      FOCACCIA_SUPABASE_UPSTREAM_PORT: String(upstreamPort),
    },
    stdio: 'inherit',
  });
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function prepareNativeNetwork({
  appName = 'gate',
  getNetworkInterfaces,
  getSupabaseStatus = defaultGetSupabaseStatus,
  isPortOpen = canConnect,
  isProxyHealthy = proxyHealthy,
  logger = console,
  repoRoot = path.resolve(import.meta.dirname, '..'),
  runtimeEnv = process.env,
  sleep = defaultSleep,
  startProxy = defaultStartProxy,
} = {}) {
  const initialEnv = readNativeEnv(repoRoot, appName);
  const mode = selectedMode(initialEnv);

  if (mode === 'tunnel') {
    applyPublicEnv(initialEnv, runtimeEnv);
    return { host: null, mode, proxy: null };
  }

  const { host } = syncTicketDevEnv({
    ...(getNetworkInterfaces ? { getNetworkInterfaces } : {}),
    logger,
    repoRoot,
  });
  applyPublicEnv(readNativeEnv(repoRoot, appName), runtimeEnv);

  const portOccupied = await isPortOpen(host, LAN_PROXY_PORT);
  if (portOccupied) {
    if (!await isProxyHealthy(host, LAN_PROXY_PORT)) {
      throw new Error(`Port ${LAN_PROXY_PORT} is occupied by an unhealthy or unexpected service.`);
    }
    logger.log(`[Native Network] Focaccia LAN proxy healthy on http://${host}:${LAN_PROXY_PORT}.`);
    return { host, mode, proxy: null };
  }

  const upstream = parseSupabaseApiEndpoint(getSupabaseStatus(repoRoot));
  const proxy = startProxy({
    host,
    repoRoot,
    upstreamHost: upstream.host,
    upstreamPort: upstream.port,
  });
  const cleanup = () => {
    if (!proxy.killed) proxy.kill('SIGTERM');
  };
  proxy.once('error', cleanup);
  process.once('exit', cleanup);

  const deadline = Date.now() + PROXY_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isProxyHealthy(host, LAN_PROXY_PORT)) {
      logger.log(`[Native Network] Focaccia LAN proxy ready on http://${host}:${LAN_PROXY_PORT}.`);
      return { host, mode, proxy };
    }
    await sleep(PROXY_POLL_INTERVAL_MS);
  }

  cleanup();
  throw new Error(`Focaccia LAN proxy did not become ready on http://${host}:${LAN_PROXY_PORT}.`);
}

export function prepareGateNetwork(options = {}) {
  return prepareNativeNetwork({ ...options, appName: 'gate' });
}
