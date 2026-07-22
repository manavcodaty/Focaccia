import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import * as bootstrap from './gate-network-bootstrap.mjs';

test('prepares the gate env and detected Supabase API port before Metro starts', async () => {
  assert.equal(typeof bootstrap.prepareGateNetwork, 'function');

  const root = mkdtempSync(path.join(tmpdir(), 'focaccia-gate-network-'));
  const runtimeEnv = {
    EXPO_PUBLIC_FOCACCIA_LOCAL_HOST: '192.168.1.20',
    EXPO_PUBLIC_FOCACCIA_NETWORK_MODE: 'local',
    EXPO_PUBLIC_FOCACCIA_SUPABASE_URL: 'http://192.168.1.20:54321',
  };
  let proxyOptions;
  let healthChecks = 0;

  try {
    mkdirSync(path.join(root, 'apps/gate'), { recursive: true });
    writeFileSync(path.join(root, 'apps/gate/.env.local'), [
      'EXPO_PUBLIC_FOCACCIA_NETWORK_MODE=local',
      'EXPO_PUBLIC_FOCACCIA_LOCAL_HOST=192.168.1.20',
      'EXPO_PUBLIC_FOCACCIA_SUPABASE_URL=http://192.168.1.20:54321',
      'EXPO_PUBLIC_FOCACCIA_WEB_URL=http://192.168.1.20:3000',
      'EXPO_PUBLIC_FOCACCIA_TICKETS_URL=http://192.168.1.20:3001',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon',
      '',
    ].join('\n'));

    await bootstrap.prepareGateNetwork({
      getNetworkInterfaces: () => ({
        en0: [{ address: '192.168.1.73', family: 'IPv4', internal: false }],
      }),
      getSupabaseStatus: () => 'API_URL="http://127.0.0.1:6543"\n',
      isPortOpen: async () => false,
      isProxyHealthy: async () => {
        healthChecks += 1;
        return healthChecks > 1;
      },
      logger: { log() {} },
      repoRoot: root,
      runtimeEnv,
      sleep: async () => {},
      startProxy: (options) => {
        proxyOptions = options;
        return { kill() {}, killed: false, once() {} };
      },
    });

    const gateEnv = readFileSync(path.join(root, 'apps/gate/.env.local'), 'utf8');
    assert.match(gateEnv, /^EXPO_PUBLIC_FOCACCIA_LOCAL_HOST=192\.168\.1\.73$/m);
    assert.match(gateEnv, /^EXPO_PUBLIC_FOCACCIA_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
    assert.equal(runtimeEnv.EXPO_PUBLIC_FOCACCIA_SUPABASE_URL, 'http://192.168.1.73:54331');
    assert.equal(proxyOptions.upstreamHost, '127.0.0.1');
    assert.equal(proxyOptions.upstreamPort, 6543);
    assert.equal(healthChecks, 2);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('prepares the enrollment env before its direct Expo run starts Metro', async () => {
  assert.equal(typeof bootstrap.prepareNativeNetwork, 'function');

  const root = mkdtempSync(path.join(tmpdir(), 'focaccia-enrollment-network-'));
  const runtimeEnv = {};

  try {
    mkdirSync(path.join(root, 'apps/enrollment'), { recursive: true });
    writeFileSync(path.join(root, 'apps/enrollment/.env.local'), [
      'EXPO_PUBLIC_FOCACCIA_NETWORK_MODE=local',
      'EXPO_PUBLIC_FOCACCIA_LOCAL_HOST=192.168.1.20',
      'EXPO_PUBLIC_FOCACCIA_SUPABASE_URL=http://192.168.1.20:54321',
      'EXPO_PUBLIC_FOCACCIA_WEB_URL=http://192.168.1.20:3000',
      'EXPO_PUBLIC_FOCACCIA_TICKETS_URL=http://192.168.1.20:3001',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon',
      '',
    ].join('\n'));

    const result = await bootstrap.prepareNativeNetwork({
      appName: 'enrollment',
      getNetworkInterfaces: () => ({
        en0: [{ address: '192.168.1.73', family: 'IPv4', internal: false }],
      }),
      isPortOpen: async () => true,
      isProxyHealthy: async () => true,
      logger: { log() {} },
      repoRoot: root,
      runtimeEnv,
    });

    assert.equal(result.mode, 'local');
    assert.equal(runtimeEnv.EXPO_PUBLIC_FOCACCIA_SUPABASE_URL, 'http://192.168.1.73:54331');
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('parses only a loopback Supabase API endpoint', () => {
  assert.equal(typeof bootstrap.parseSupabaseApiEndpoint, 'function');
  assert.deepEqual(
    bootstrap.parseSupabaseApiEndpoint('API_URL="http://127.0.0.1:61234"\n'),
    { host: '127.0.0.1', port: 61234 },
  );
  assert.throws(
    () => bootstrap.parseSupabaseApiEndpoint('API_URL="http://192.168.1.10:54321"\n'),
    /loopback/i,
  );
});

test('prepares automatically only for Expo run:ios', () => {
  assert.equal(typeof bootstrap.shouldPrepareGateNetwork, 'function');
  assert.equal(bootstrap.shouldPrepareGateNetwork(['node', 'expo', 'run:ios']), true);
  assert.equal(bootstrap.shouldPrepareGateNetwork(['node', 'expo', 'export']), false);
  assert.equal(bootstrap.shouldPrepareGateNetwork(['node', 'expo', 'start']), false);
});

test('tunnel mode preserves selected env without probing or starting local services', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'focaccia-gate-tunnel-'));
  const runtimeEnv = {};

  try {
    mkdirSync(path.join(root, 'apps/gate'), { recursive: true });
    writeFileSync(path.join(root, 'apps/gate/.env.local'), [
      'EXPO_PUBLIC_FOCACCIA_NETWORK_MODE=tunnel',
      'EXPO_PUBLIC_FOCACCIA_SUPABASE_URL=https://api.example.test',
      'EXPO_PUBLIC_FOCACCIA_WEB_URL=https://web.example.test',
      'EXPO_PUBLIC_FOCACCIA_TICKETS_URL=https://tickets.example.test',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon',
      '',
    ].join('\n'));

    const result = await bootstrap.prepareGateNetwork({
      getSupabaseStatus: () => assert.fail('tunnel mode must not query local Supabase'),
      repoRoot: root,
      runtimeEnv,
      startProxy: () => assert.fail('tunnel mode must not start a local proxy'),
    });

    assert.equal(result.mode, 'tunnel');
    assert.equal(runtimeEnv.EXPO_PUBLIC_FOCACCIA_SUPABASE_URL, 'https://api.example.test');
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
