import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { syncTicketDevEnv } from './sync-ticket-dev-env.mjs';

const WEB_PORT = '3000';
const TICKETS_PORT = '3001';
const LAN_PROXY_PORT = 54331;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const organizerRoot = path.join(repoRoot, 'apps/web');

export function buildAllowedBrowserOrigins(host) {
  return [
    host,
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ].flatMap((originHost) => [
    `http://${originHost}:${WEB_PORT}`,
    `http://${originHost}:${TICKETS_PORT}`,
  ]);
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

function start(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      process.stderr.write(`${label} exited with code ${code}${signal ? ` (${signal})` : ''}.\n`);
    }
  });

  return child;
}

async function startOrganizerDev() {
  const { host } = syncTicketDevEnv();
  const children = [];

  if (await canConnect(host, LAN_PROXY_PORT)) {
    process.stdout.write(`Focaccia LAN proxy already listening on http://${host}:${LAN_PROXY_PORT}.\n`);
  } else {
    children.push(start('constrained Supabase proxy', process.execPath, ['scripts/lan-supabase-proxy.mjs'], {
      env: {
        FOCACCIA_ALLOWED_BROWSER_ORIGINS: buildAllowedBrowserOrigins(host).join(','),
        FOCACCIA_LAN_PROXY_PORT: String(LAN_PROXY_PORT),
        FOCACCIA_LOCAL_HOST: host,
      },
    }));
  }

  const next = start('organizer web app', 'pnpm', [
    'exec',
    'next',
    'dev',
    '--hostname',
    '0.0.0.0',
    '--port',
    WEB_PORT,
  ], { cwd: organizerRoot });
  children.push(next);

  function stopChildren(signal) {
    for (const child of [...children].reverse()) {
      if (!child.killed) {
        child.kill(signal);
      }
    }
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      stopChildren(signal);
      process.exitCode = 0;
    });
  }

  next.on('exit', (code) => {
    stopChildren('SIGTERM');
    process.exitCode = code ?? 0;
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startOrganizerDev().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Organizer dev startup failed.'}\n`);
    process.exitCode = 1;
  });
}
