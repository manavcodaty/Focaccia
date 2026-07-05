import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { buildRuntimeSupabaseConfig } from './lib/runtime-supabase-config.mjs';
import {
  createLanSupabaseProxy,
  isAllowedBrowserOrigin,
  isAllowedProxyPath,
} from './lan-supabase-proxy.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('runtime Supabase config uses exact selected Auth URLs', () => {
  const source = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
  const output = buildRuntimeSupabaseConfig(source, {
    browserOrigins: ['http://192.168.1.50:3000', 'http://192.168.1.50:3001'],
    diagnosticLabel: 'Local network',
    localHost: '192.168.1.50',
    mode: 'local',
    supabaseUrl: 'http://192.168.1.50:54321',
    ticketsUrl: 'http://192.168.1.50:3001',
    webUrl: 'http://192.168.1.50:3000',
  });

  assert.match(output, /site_url = "http:\/\/192\.168\.1\.50:3001"/);
  assert.match(
    output,
    /additional_redirect_urls = \["http:\/\/192\.168\.1\.50:3000", "http:\/\/192\.168\.1\.50:3001"\]/,
  );
  assert.doesNotMatch(output, /additional_redirect_urls = \["https:\/\/127\.0\.0\.1:3000"\]/);
  assert.match(output, /\[studio\][\s\S]*?enabled = false/);
  assert.match(output, /\[inbucket\][\s\S]*?enabled = false/);
});

test('LAN proxy allows only required Supabase HTTP and WebSocket paths', () => {
  for (const allowed of [
    '/auth/v1/health',
    '/rest/v1/events',
    '/functions/v1/create-event',
    '/realtime/v1/websocket?apikey=redacted',
    '/storage/v1/object/example',
  ]) {
    assert.equal(isAllowedProxyPath(allowed), true, allowed);
  }

  for (const rejected of ['/', '/pg', '/studio', '/api/forward?url=https://example.com']) {
    assert.equal(isAllowedProxyPath(rejected), false, rejected);
  }
});

test('LAN proxy applies the same origin policy to HTTP and WebSocket requests', () => {
  const allowedOrigins = ['http://192.168.1.50:3000'];
  assert.equal(isAllowedBrowserOrigin(null, allowedOrigins), true);
  assert.equal(isAllowedBrowserOrigin(allowedOrigins[0], allowedOrigins), true);
  assert.equal(isAllowedBrowserOrigin('https://attacker.example', allowedOrigins), false);
});

test('LAN proxy enforces exact browser origins and native no-Origin requests', async () => {
  const upstream = (await import('node:http')).createServer((_request, response) => {
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end('ok');
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamAddress = upstream.address();
  const proxy = createLanSupabaseProxy({
    allowedOrigins: ['http://192.168.1.50:3000'],
    bindHost: '127.0.0.1',
    bindPort: 0,
    upstreamPort: upstreamAddress.port,
  });

  try {
    const address = await proxy.listen();
    const url = `http://127.0.0.1:${address.port}/auth/v1/health`;
    const nativeResponse = await fetch(url);
    assert.equal(nativeResponse.headers.get('access-control-allow-origin'), null);
    const allowedResponse = await fetch(url, { headers: { Origin: 'http://192.168.1.50:3000' } });
    assert.equal(allowedResponse.headers.get('access-control-allow-origin'), 'http://192.168.1.50:3000');
    const preflightResponse = await fetch(url, {
      headers: {
        'Access-Control-Request-Headers': 'accept-profile,apikey,content-profile,content-type,x-supabase-api-version',
        'Access-Control-Request-Method': 'POST',
        Origin: 'http://192.168.1.50:3000',
      },
      method: 'OPTIONS',
    });
    assert.equal(preflightResponse.status, 204);
    assert.match(
      preflightResponse.headers.get('access-control-allow-headers') ?? '',
      /x-supabase-api-version/,
    );
    assert.match(
      preflightResponse.headers.get('access-control-allow-headers') ?? '',
      /accept-profile/,
    );
    const rejectedResponse = await fetch(url, { headers: { Origin: 'https://attacker.example' } });
    assert.equal(rejectedResponse.status, 403);
  } finally {
    await proxy.close();
    await new Promise((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
  }
});

test('EAS profiles select local and tunnel modes explicitly', () => {
  for (const app of ['enrollment', 'gate']) {
    const eas = JSON.parse(readFileSync(path.join(root, `apps/${app}/eas.json`), 'utf8'));

    assert.equal(eas.build['development-local'].env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE, 'local');
    assert.equal(eas.build['development-tunnel'].env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE, 'tunnel');
    assert.equal(eas.build['preview-local'].env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE, 'local');
    assert.equal(eas.build['preview-tunnel'].env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE, 'tunnel');
    assert.equal(eas.build['production-tunnel'].env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE, 'tunnel');
  }
});

test('iOS networking permits LAN without globally disabling ATS', () => {
  for (const app of ['enrollment', 'gate']) {
    const plist = readFileSync(
      path.join(root, `apps/${app}/ios/${app === 'gate' ? 'FacePassGate' : 'FacePassEnrollment'}/Info.plist`),
      'utf8',
    );
    const appConfig = readFileSync(path.join(root, `apps/${app}/app.json`), 'utf8');

    assert.match(plist, /<key>NSAllowsArbitraryLoads<\/key>\s*<false\/>/);
    assert.match(plist, /<key>NSAllowsLocalNetworking<\/key>\s*<true\/>/);
    assert.match(plist, /Focaccia connects to services running on the organizer's Mac/);
    assert.match(appConfig, /NSLocalNetworkUsageDescription/);
    assert.match(appConfig, /NSAllowsLocalNetworking/);
  }
});

test('public runtime adapters do not read server-only environment variables', () => {
  const sources = [
    'apps/landing/src/lib/portal-links.ts',
    'apps/web/lib/env.ts',
    'apps/tickets/lib/env.ts',
    'apps/enrollment/src/lib/env.ts',
    'apps/gate/src/lib/env.ts',
  ].map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n');

  assert.doesNotMatch(sources, /SERVICE_ROLE|ORGANIZER_EMAIL_ALLOWLIST|SECRET_WRAPPING|DATABASE_URL/);
  assert.doesNotMatch(sources, /process\.env\[[^\]]+\]/);
});

test('selected public browser env is generated for landing, organizer, and tickets apps', () => {
  const source = readFileSync(path.join(root, 'scripts/lib/network-environment.mjs'), 'utf8');

  assert.match(source, /for \(const app of \['landing', 'web', 'tickets'\]\)/);
  assert.match(source, /serializePublicEnv\('NEXT_PUBLIC_', config, anonKey\)/);
  assert.match(source, /chmodSync\(envPath, 0o600\)/);
});

test('dependency security overrides live in pnpm workspace config for the active pnpm version', () => {
  const workspace = readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  const manifest = readFileSync(path.join(root, 'package.json'), 'utf8');

  assert.match(workspace, /^overrides:/m);
  assert.match(workspace, /@babel\/core@7\.29\.0': 7\.29\.6/);
  assert.match(workspace, /brace-expansion@1\.1\.12: 1\.1\.13/);
  assert.match(workspace, /js-yaml@4\.1\.1: 4\.2\.0/);
  assert.match(workspace, /postcss@8\.4\.31: 8\.5\.10/);
  assert.match(workspace, /undici@7\.27\.2: 7\.28\.0/);
  assert.match(workspace, /ws@8\.20\.1: 8\.21\.0/);
  assert.doesNotMatch(manifest, /"pnpm"\s*:\s*\{/);
});
