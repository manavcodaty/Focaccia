import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { buildRuntimeSupabaseConfig } from './runtime-supabase-config.mjs';
import { repoRoot } from './network-environment.mjs';

export const runtimeRoot = path.join(repoRoot, '.focaccia/runtime');
export const runtimeSupabaseDir = path.join(runtimeRoot, 'supabase');
export const runtimeFunctionsEnvPath = path.join(runtimeRoot, 'functions.env');

function ensureSymlink(name) {
  const target = path.join(repoRoot, 'supabase', name);
  const link = path.join(runtimeSupabaseDir, name);

  if (!existsSync(link)) {
    symlinkSync(target, link, 'junction');
  }
}

export function prepareRuntimeProject(config) {
  mkdirSync(runtimeSupabaseDir, { recursive: true });
  const runtimePackagesDir = path.join(runtimeRoot, 'packages');
  const sharedPackageLink = path.join(runtimePackagesDir, 'shared');
  mkdirSync(runtimePackagesDir, { recursive: true });

  if (!existsSync(sharedPackageLink)) {
    symlinkSync(path.join(repoRoot, 'packages/shared'), sharedPackageLink, 'junction');
  }

  const source = readFileSync(path.join(repoRoot, 'supabase/config.toml'), 'utf8');
  writeFileSync(
    path.join(runtimeSupabaseDir, 'config.toml'),
    buildRuntimeSupabaseConfig(source, config),
  );

  for (const name of ['functions', 'migrations', 'seed.sql']) {
    ensureSymlink(name);
  }
}

function getOrCreateSecret(filename) {
  const keyPath = path.join(runtimeRoot, filename);

  if (!existsSync(keyPath)) {
    writeFileSync(keyPath, `${randomBytes(32).toString('base64url')}\n`, { mode: 0o600 });
  }

  return readFileSync(keyPath, 'utf8').trim();
}

export function writeRuntimeFunctionsEnv(config, { anonKey, serviceRoleKey }, sourceEnv = {}) {
  const organizerAllowlist = sourceEnv.FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST?.trim();

  if (!organizerAllowlist) {
    throw new Error('FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST is required and must remain server-only.');
  }

  const entries = {
    FACE_PASS_LIVENESS_TIMEOUT_MS: '20000',
    FACE_PASS_MATCH_THRESHOLD: '112',
    FACE_PASS_QUEUE_CODE_DIGITS: '8',
    FACE_PASS_SECRET_WRAPPING_KEY_B64URL: getOrCreateSecret('secret-wrapping-key'),
    FACE_PASS_SUPABASE_ANON_KEY: anonKey,
    FACE_PASS_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    FACE_PASS_SUPABASE_URL: 'http://127.0.0.1:54321',
    FOCACCIA_CLAIM_CODE_PEPPER: sourceEnv.FOCACCIA_CLAIM_CODE_PEPPER?.trim()
      || getOrCreateSecret('claim-code-pepper'),
    FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST: organizerAllowlist,
    FOCACCIA_NETWORK_MODE: config.mode,
    ...(config.localHost ? { FOCACCIA_LOCAL_HOST: config.localHost } : {}),
    ...(config.mode === 'local' ? {
      FOCACCIA_LOCAL_SUPABASE_URL: config.supabaseUrl,
      FOCACCIA_LOCAL_TICKETS_URL: config.ticketsUrl,
      FOCACCIA_LOCAL_WEB_URL: config.webUrl,
    } : {
      FOCACCIA_TUNNEL_SUPABASE_URL: config.supabaseUrl,
      FOCACCIA_TUNNEL_TICKETS_URL: config.ticketsUrl,
      FOCACCIA_TUNNEL_WEB_URL: config.webUrl,
    }),
  };

  writeFileSync(
    runtimeFunctionsEnvPath,
    `${Object.entries(entries).map(([key, value]) => `${key}=${value}`).join('\n')}\n`,
    { mode: 0o600 },
  );
  chmodSync(runtimeFunctionsEnvPath, 0o600);
}
