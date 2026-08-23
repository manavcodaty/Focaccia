import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
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

test('LAN proxy exposes a proxy-owned health marker', async () => {
  const proxy = createLanSupabaseProxy({ bindHost: '127.0.0.1', bindPort: 0 });
  const address = await proxy.listen();

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/.focaccia/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-focaccia-proxy'), '1');
    assert.deepEqual(await response.json(), { service: 'focaccia-lan-supabase-proxy' });
  } finally {
    await proxy.close();
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

test('LAN proxy forwards WebSocket upgrade head bytes to the correct socket', async () => {
  const clientHead = Buffer.from('client-first-frame');
  const upstreamHead = Buffer.from('upstream-first-frame');
  let upstreamUpgradeHead = Buffer.alloc(0);
  let receivedClientHeadResolve;
  const receivedClientHeadPromise = new Promise((resolve) => {
    receivedClientHeadResolve = resolve;
  });
  const upstream = http.createServer();
  upstream.on('upgrade', (_request, socket, head) => {
    upstreamUpgradeHead = Buffer.from(head);
    let received = Buffer.from(head);
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.includes(clientHead)) {
        receivedClientHeadResolve();
        socket.end();
      }
    });
    socket.write(
      Buffer.concat([
        Buffer.from('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'),
        upstreamHead,
      ]),
    );
  });
  await new Promise((resolve, reject) => {
    upstream.once('error', reject);
    upstream.listen(0, '127.0.0.1', resolve);
  });
  const upstreamAddress = upstream.address();
  const proxy = createLanSupabaseProxy({
    allowedOrigins: ['http://192.168.1.50:3000'],
    bindHost: '127.0.0.1',
    bindPort: 0,
    upstreamPort: upstreamAddress.port,
  });
  let client;

  try {
    const proxyAddress = await proxy.listen();
    client = net.connect(proxyAddress.port, '127.0.0.1');
    await new Promise((resolve, reject) => {
      client.once('error', reject);
      client.once('connect', resolve);
    });
    const responsePromise = new Promise((resolve, reject) => {
      const chunks = [];
      const timer = setTimeout(() => reject(new Error('Timed out waiting for proxied WebSocket response.')), 5_000);
      client.on('data', (chunk) => {
        chunks.push(chunk);
        const response = Buffer.concat(chunks);
        if (response.includes(upstreamHead)) {
          clearTimeout(timer);
          resolve(response);
        }
      });
      client.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    client.write(
      Buffer.concat([
        Buffer.from(
          'GET /realtime/v1/websocket HTTP/1.1\r\n'
          + 'Host: 127.0.0.1\r\n'
          + 'Origin: http://192.168.1.50:3000\r\n'
          + 'Connection: Upgrade\r\n'
          + 'Upgrade: websocket\r\n'
          + 'Sec-WebSocket-Version: 13\r\n'
          + 'Sec-WebSocket-Key: ZHVtbXkta2V5\r\n\r\n',
        ),
        clientHead,
      ]),
    );
    const response = await responsePromise;
    await Promise.race([
      receivedClientHeadPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for client upgrade bytes.')), 5_000)),
    ]);
    assert.equal(upstreamUpgradeHead.length, 0);
    assert.match(response.toString(), /^HTTP\/1\.1 101 Switching Protocols/);
  } finally {
    client?.destroy();
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
