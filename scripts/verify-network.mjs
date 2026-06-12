import { execFileSync } from 'node:child_process';
import net from 'node:net';

import { loadNetworkEnvironment, printNetworkSummary } from './lib/network-environment.mjs';

const mode = process.argv[2];

if (mode !== 'local' && mode !== 'tunnel') {
  throw new Error('Usage: node scripts/verify-network.mjs <local|tunnel>');
}

const { config } = loadNetworkEnvironment(mode);

function checkTcp(url, timeoutMs = 3000) {
  const parsed = new URL(url);
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));

  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: parsed.hostname, port });
    const timer = setTimeout(() => socket.destroy(new Error(`Timed out connecting to ${parsed.host}.`)), timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.once('error', reject);
  });
}

function canConnect(host, port, timeoutMs = 750) {
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

async function checkResponse(label, url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  const body = await response.text();

  if (body.match(/zrok.*interstitial|click.*continue|skip_zrok_interstitial/i)) {
    throw new Error(`${label} returned a zrok interstitial instead of the service response.`);
  }

  process.stdout.write(`PASS ${label}: HTTP ${response.status}\n`);
  return { body, response };
}

if (mode === 'local') {
  const interfaces = execFileSync('/sbin/ifconfig', [], { encoding: 'utf8' });

  if (!interfaces.includes(`inet ${config.localHost} `)) {
    throw new Error(`FOCACCIA_LOCAL_HOST ${config.localHost} is not assigned to this Mac.`);
  }

  for (const [label, port] of [['PostgreSQL', 54322], ['Supabase Studio', 54323]]) {
    if (await canConnect(config.localHost, port)) {
      throw new Error(`${label} port ${port} is exposed on the LAN.`);
    }
    process.stdout.write(`PASS ${label} is not exposed on the LAN\n`);
  }

  try {
    execFileSync('pgrep', ['-f', 'zrok'], { stdio: 'ignore' });
    throw new Error('A zrok process is running. Stop every tunnel before local-mode verification.');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A zrok process')) {
      throw error;
    }
  }
}

printNetworkSummary(config);
await checkTcp(config.supabaseUrl);
process.stdout.write('PASS Supabase TCP reachability\n');
const nativeAuth = await checkResponse('Supabase Auth health', `${config.supabaseUrl}/auth/v1/health`);
if (nativeAuth.response.headers.has('access-control-allow-origin')) {
  throw new Error('Native no-Origin request received an Access-Control-Allow-Origin header.');
}
const allowed = await checkResponse('Allowed browser origin', `${config.supabaseUrl}/functions/v1/get-enrollment-bundle`, {
  method: 'OPTIONS',
  headers: {
    'Access-Control-Request-Method': 'POST',
    Origin: config.webUrl,
  },
});
if (allowed.response.headers.get('access-control-allow-origin') !== config.webUrl) {
  throw new Error('Allowed browser origin was not reflected exactly.');
}
const rejected = await checkResponse('Unauthorized browser origin', `${config.supabaseUrl}/functions/v1/get-enrollment-bundle`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://attacker.example',
  },
  body: '{}',
});

if (rejected.response.status !== 403) {
  throw new Error(`Unauthorized browser origin returned ${rejected.response.status}, expected 403.`);
}

await checkResponse('Web app', config.webUrl);
await checkResponse('Tickets app', `${config.ticketsUrl}/api/health`);
process.stdout.write(`PASS ${mode} network verification completed without printing credentials.\n`);
