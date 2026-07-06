import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { syncTicketDevEnv } from './sync-ticket-dev-env.mjs';

function tempRepo() {
  return mkdtempSync(path.join(tmpdir(), 'focaccia-ticket-dev-env-'));
}

test('syncs enrollment ticket URL to the current Mac LAN IP', () => {
  const root = tempRepo();

  try {
    mkdirSync(path.join(root, 'apps/enrollment'), { recursive: true });
    mkdirSync(path.join(root, 'apps/tickets'), { recursive: true });
    writeFileSync(
      path.join(root, 'apps/enrollment/.env.local'),
      [
        'EXPO_PUBLIC_FOCACCIA_NETWORK_MODE=local',
        'EXPO_PUBLIC_FOCACCIA_LOCAL_HOST=192.168.1.20',
        'EXPO_PUBLIC_FOCACCIA_SUPABASE_URL=http://192.168.1.20:54331',
        'EXPO_PUBLIC_FOCACCIA_WEB_URL=http://192.168.1.20:3000',
        'EXPO_PUBLIC_FOCACCIA_TICKETS_URL=http://192.168.1.20:3001',
        'EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon',
        '',
      ].join('\n'),
    );
    writeFileSync(
      path.join(root, 'apps/tickets/.env.local'),
      [
        'NEXT_PUBLIC_FOCACCIA_NETWORK_MODE=local',
        'NEXT_PUBLIC_FOCACCIA_LOCAL_HOST=192.168.1.20',
        'NEXT_PUBLIC_FOCACCIA_SUPABASE_URL=http://192.168.1.20:54331',
        'NEXT_PUBLIC_FOCACCIA_WEB_URL=http://192.168.1.20:3000',
        'NEXT_PUBLIC_FOCACCIA_TICKETS_URL=http://192.168.1.20:3001',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon',
        '',
      ].join('\n'),
    );
    const result = syncTicketDevEnv({
      getNetworkInterfaces: () => ({
        en0: [{
          address: '192.168.1.73',
          family: 'IPv4',
          internal: false,
        }],
      }),
      logger: { log() {} },
      repoRoot: root,
    });

    const enrollmentEnv = readFileSync(path.join(root, 'apps/enrollment/.env.local'), 'utf8');
    const ticketsEnv = readFileSync(path.join(root, 'apps/tickets/.env.local'), 'utf8');

    assert.equal(result.host, '192.168.1.73');
    assert.match(enrollmentEnv, /^EXPO_PUBLIC_FOCACCIA_LOCAL_HOST=192\.168\.1\.73$/m);
    assert.match(enrollmentEnv, /^EXPO_PUBLIC_FOCACCIA_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
    assert.match(enrollmentEnv, /^EXPO_PUBLIC_FOCACCIA_TICKETS_URL=http:\/\/192\.168\.1\.73:3001$/m);
    assert.match(enrollmentEnv, /^EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon$/m);
    assert.match(ticketsEnv, /^NEXT_PUBLIC_FOCACCIA_TICKETS_URL=http:\/\/192\.168\.1\.73:3001$/m);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('normalizes stale direct Supabase ports to the constrained proxy', () => {
  const root = tempRepo();

  try {
    mkdirSync(path.join(root, 'apps/enrollment'), { recursive: true });
    mkdirSync(path.join(root, 'apps/tickets'), { recursive: true });
    mkdirSync(path.join(root, 'apps/web'), { recursive: true });
    writeFileSync(
      path.join(root, 'apps/enrollment/.env.local'),
      [
        'EXPO_PUBLIC_FOCACCIA_NETWORK_MODE=local',
        'EXPO_PUBLIC_FOCACCIA_LOCAL_HOST=192.168.1.20',
        'EXPO_PUBLIC_FOCACCIA_SUPABASE_URL=http://192.168.1.20:54321',
        'EXPO_PUBLIC_FOCACCIA_WEB_URL=http://192.168.1.20:3000',
        'EXPO_PUBLIC_FOCACCIA_TICKETS_URL=http://192.168.1.20:3001',
        '',
      ].join('\n'),
    );
    writeFileSync(
      path.join(root, 'apps/tickets/.env.local'),
      [
        'NEXT_PUBLIC_FOCACCIA_NETWORK_MODE=local',
        'NEXT_PUBLIC_FOCACCIA_LOCAL_HOST=192.168.1.20',
        'NEXT_PUBLIC_FOCACCIA_SUPABASE_URL=http://192.168.1.20:54321',
        'NEXT_PUBLIC_FOCACCIA_WEB_URL=http://192.168.1.20:3000',
        'NEXT_PUBLIC_FOCACCIA_TICKETS_URL=http://192.168.1.20:3001',
        '',
      ].join('\n'),
    );
    writeFileSync(
      path.join(root, 'apps/web/.env.local'),
      [
        'NEXT_PUBLIC_FOCACCIA_NETWORK_MODE=local',
        'NEXT_PUBLIC_FOCACCIA_LOCAL_HOST=192.168.1.20',
        'NEXT_PUBLIC_FOCACCIA_SUPABASE_URL=http://192.168.1.20:54321',
        'NEXT_PUBLIC_FOCACCIA_WEB_URL=http://192.168.1.20:3000',
        'NEXT_PUBLIC_FOCACCIA_TICKETS_URL=http://192.168.1.20:3001',
        '',
      ].join('\n'),
    );

    syncTicketDevEnv({
      getNetworkInterfaces: () => ({
        en0: [{
          address: '192.168.1.73',
          family: 'IPv4',
          internal: false,
        }],
      }),
      logger: { log() {} },
      repoRoot: root,
    });

    const enrollmentEnv = readFileSync(path.join(root, 'apps/enrollment/.env.local'), 'utf8');
    const ticketsEnv = readFileSync(path.join(root, 'apps/tickets/.env.local'), 'utf8');
    const webEnv = readFileSync(path.join(root, 'apps/web/.env.local'), 'utf8');

    assert.match(enrollmentEnv, /^EXPO_PUBLIC_FOCACCIA_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
    assert.match(ticketsEnv, /^NEXT_PUBLIC_FOCACCIA_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
    assert.match(webEnv, /^NEXT_PUBLIC_FOCACCIA_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('syncs root local env URLs for organizer dev startup', () => {
  const root = tempRepo();

  try {
    writeFileSync(
      path.join(root, '.env.local'),
      [
        'FOCACCIA_NETWORK_MODE=local',
        'FOCACCIA_LOCAL_HOST=192.168.1.20',
        'FOCACCIA_LOCAL_SUPABASE_URL=http://192.168.1.20:54321',
        'FOCACCIA_LOCAL_WEB_URL=http://192.168.1.20:3000',
        'FOCACCIA_LOCAL_TICKETS_URL=http://192.168.1.20:3001',
        'FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST=organizer@example.com',
        '',
      ].join('\n'),
    );

    syncTicketDevEnv({
      getNetworkInterfaces: () => ({
        en0: [{
          address: '192.168.1.73',
          family: 'IPv4',
          internal: false,
        }],
      }),
      logger: { log() {} },
      repoRoot: root,
    });

    const rootEnv = readFileSync(path.join(root, '.env.local'), 'utf8');

    assert.match(rootEnv, /^FOCACCIA_NETWORK_MODE=local$/m);
    assert.match(rootEnv, /^FOCACCIA_LOCAL_HOST=192\.168\.1\.73$/m);
    assert.match(rootEnv, /^FOCACCIA_LOCAL_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
    assert.match(rootEnv, /^FOCACCIA_LOCAL_WEB_URL=http:\/\/192\.168\.1\.73:3000$/m);
    assert.match(rootEnv, /^FOCACCIA_LOCAL_TICKETS_URL=http:\/\/192\.168\.1\.73:3001$/m);
    assert.match(rootEnv, /^FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST=organizer@example\.com$/m);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('syncs local edge function network URLs to the current Mac LAN IP', () => {
  const root = tempRepo();

  try {
    mkdirSync(path.join(root, 'supabase/functions'), { recursive: true });
    writeFileSync(
      path.join(root, 'supabase/functions/.env.local'),
      [
        'SUPABASE_URL=http://127.0.0.1:54321',
        'SUPABASE_ANON_KEY=anon-key',
        'SUPABASE_SERVICE_ROLE_KEY=service-role-key',
        'FACE_PASS_SECRET_WRAPPING_KEY_B64URL=secret',
        'FOCACCIA_NETWORK_MODE=local',
        'FOCACCIA_LOCAL_HOST=192.168.1.20',
        'FOCACCIA_LOCAL_SUPABASE_URL=http://192.168.1.20:54321',
        'FOCACCIA_LOCAL_WEB_URL=http://192.168.1.20:3000',
        'FOCACCIA_LOCAL_TICKETS_URL=http://192.168.1.20:3001',
        '',
      ].join('\n'),
    );
    writeFileSync(
      path.join(root, 'supabase/functions/.env'),
      [
        'FACE_PASS_SUPABASE_URL=http://127.0.0.1:54321',
        'FACE_PASS_SUPABASE_ANON_KEY=anon-key',
        'FACE_PASS_SUPABASE_SERVICE_ROLE_KEY=service-role-key',
        'FOCACCIA_NETWORK_MODE=local',
        'FOCACCIA_LOCAL_HOST=192.168.1.20',
        'FOCACCIA_LOCAL_SUPABASE_URL=http://192.168.1.20:54321',
        'FOCACCIA_LOCAL_WEB_URL=http://192.168.1.20:3000',
        'FOCACCIA_LOCAL_TICKETS_URL=http://192.168.1.20:3001',
        '',
      ].join('\n'),
    );

    syncTicketDevEnv({
      getNetworkInterfaces: () => ({
        en0: [{
          address: '192.168.1.73',
          family: 'IPv4',
          internal: false,
        }],
      }),
      logger: { log() {} },
      repoRoot: root,
    });

    const functionsEnv = readFileSync(path.join(root, 'supabase/functions/.env.local'), 'utf8');
    const generatedFunctionsEnv = readFileSync(path.join(root, 'supabase/functions/.env'), 'utf8');

    assert.match(functionsEnv, /^FOCACCIA_NETWORK_MODE=local$/m);
    assert.match(functionsEnv, /^FOCACCIA_LOCAL_HOST=192\.168\.1\.73$/m);
    assert.match(functionsEnv, /^FOCACCIA_LOCAL_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
    assert.match(functionsEnv, /^FOCACCIA_LOCAL_WEB_URL=http:\/\/192\.168\.1\.73:3000$/m);
    assert.match(functionsEnv, /^FOCACCIA_LOCAL_TICKETS_URL=http:\/\/192\.168\.1\.73:3001$/m);
    assert.match(functionsEnv, /^SUPABASE_SERVICE_ROLE_KEY=service-role-key$/m);
    assert.match(generatedFunctionsEnv, /^FOCACCIA_LOCAL_HOST=192\.168\.1\.73$/m);
    assert.match(generatedFunctionsEnv, /^FOCACCIA_LOCAL_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
    assert.match(generatedFunctionsEnv, /^FACE_PASS_SUPABASE_SERVICE_ROLE_KEY=service-role-key$/m);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
