import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { parseRootNetworkConfig } from '../../packages/shared/dist/network-config.js';

export const repoRoot = path.resolve(import.meta.dirname, '../..');

export function parseEnvText(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return [];
    }

    const separator = trimmed.indexOf('=');

    if (separator < 1) {
      throw new Error(`Invalid env line: ${line}`);
    }

    return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim()]];
  }));
}

export function loadNetworkEnvironment(mode, { allowExample = false } = {}) {
  const filename = mode === 'local' ? '.env.local' : '.env.tunnel.local';
  const actualPath = path.join(repoRoot, filename);
  const examplePath = path.join(repoRoot, mode === 'local' ? '.env.local.example' : '.env.tunnel.example');
  const selectedPath = existsSync(actualPath) ? actualPath : allowExample ? examplePath : null;

  if (!selectedPath) {
    throw new Error(`Missing ${filename}. Copy ${path.basename(examplePath)} and configure it first.`);
  }

  const env = {
    ...parseEnvText(readFileSync(selectedPath, 'utf8')),
    ...process.env,
  };
  const config = parseRootNetworkConfig(env);

  if (config.mode !== mode) {
    throw new Error(`${path.basename(selectedPath)} selects ${config.mode}, but ${mode} was requested.`);
  }

  return { config, env, path: selectedPath };
}

export function parseSupabaseStatusEnv(text) {
  const values = parseEnvText(text.replace(/^export /gm, ''));
  const anonKey = values.ANON_KEY;
  const serviceRoleKey = values.SERVICE_ROLE_KEY;

  if (!anonKey || !serviceRoleKey) {
    throw new Error('Supabase status did not return ANON_KEY and SERVICE_ROLE_KEY.');
  }

  return { anonKey, serviceRoleKey };
}

function serializePublicEnv(prefix, config, anonKey) {
  const lines = [
    `${prefix}FOCACCIA_NETWORK_MODE=${config.mode}`,
    ...(config.localHost ? [`${prefix}FOCACCIA_LOCAL_HOST=${config.localHost}`] : []),
    `${prefix}FOCACCIA_SUPABASE_URL=${config.supabaseUrl}`,
    `${prefix}FOCACCIA_WEB_URL=${config.webUrl}`,
    `${prefix}FOCACCIA_TICKETS_URL=${config.ticketsUrl}`,
    `${prefix}SUPABASE_ANON_KEY=${anonKey}`,
  ];

  return `${lines.join('\n')}\n`;
}

export function writeSelectedPublicEnv(config, anonKey) {
  for (const app of ['landing', 'web', 'tickets']) {
    const envPath = path.join(repoRoot, `apps/${app}/.env.local`);
    writeFileSync(envPath, serializePublicEnv('NEXT_PUBLIC_', config, anonKey), { mode: 0o600 });
    chmodSync(envPath, 0o600);
  }

  for (const app of ['enrollment', 'gate']) {
    const envPath = path.join(repoRoot, `apps/${app}/.env.local`);
    writeFileSync(envPath, serializePublicEnv('EXPO_PUBLIC_', config, anonKey), { mode: 0o600 });
    chmodSync(envPath, 0o600);
  }
}

export function printNetworkSummary(config) {
  process.stdout.write([
    `Mode: ${config.mode} (${config.diagnosticLabel})`,
    `Supabase: ${config.supabaseUrl}`,
    `Web: ${config.webUrl}`,
    `Tickets: ${config.ticketsUrl}`,
    `Allowed browser origins: ${config.browserOrigins.join(', ')}`,
  ].join('\n') + '\n');
}
