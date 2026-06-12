import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';

import {
  loadNetworkEnvironment,
  parseSupabaseStatusEnv,
  printNetworkSummary,
  repoRoot,
  writeSelectedPublicEnv,
} from './lib/network-environment.mjs';
import {
  prepareRuntimeProject,
  runtimeFunctionsEnvPath,
  runtimeRoot,
  writeRuntimeFunctionsEnv,
} from './lib/network-runtime.mjs';

const mode = process.argv[2];

if (mode !== 'local' && mode !== 'tunnel') {
  throw new Error('Usage: node scripts/demo.mjs <local|tunnel>');
}

const { config, env } = loadNetworkEnvironment(mode);
const children = [];
const commandEnv = {
  ...process.env,
  ...(env.FOCACCIA_DOCKER_HOST ? { DOCKER_HOST: env.FOCACCIA_DOCKER_HOST } : {}),
  PATH: `/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}`,
};

function failFast(error) {
  stopChildren('SIGTERM');
  process.stderr.write(`${error instanceof Error ? error.message : 'Demo startup failed.'}\n`);
  setTimeout(() => process.exit(1), 100);
}

process.on('uncaughtException', failFast);
process.on('unhandledRejection', failFast);

function commandExists(command) {
  try {
    execFileSync('which', [command], { env: commandEnv, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: commandEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(`${command} failed. Rerun it directly with --debug for diagnostics.`);
  }
}

function tryRun(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: commandEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

function start(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...commandEnv, ...options.env },
    stdio: options.quiet ? 'ignore' : 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      process.stderr.write(`${label} exited with code ${code}${signal ? ` (${signal})` : ''}.\n`);
    }
  });
  children.push(child);
  process.stdout.write(`Started ${label} (pid ${child.pid}).\n`);
  return child;
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

async function ensureLoopbackSupabaseForward() {
  if (await canConnect('127.0.0.1', 54321) && await canConnect('127.0.0.1', 54322)) {
    return;
  }

  if (commandEnv.DOCKER_HOST?.startsWith('ssh://')) {
    const sshHost = new URL(commandEnv.DOCKER_HOST).hostname;
    start('Supabase loopback forward', 'ssh', [
      '-o', 'ControlMaster=no',
      '-o', 'ControlPath=none',
      '-N',
      '-L', '127.0.0.1:54321:127.0.0.1:54321',
      '-L', '127.0.0.1:54322:127.0.0.1:54322',
      sshHost,
    ], { quiet: true });
    return;
  }

  const dockerContext = run('docker', ['context', 'show'], { capture: true }).trim();

  if (!dockerContext.startsWith('colima')) {
    throw new Error('Supabase is not reachable on loopback and the active Docker context is not Colima.');
  }

  const profile = dockerContext === 'colima' ? 'default' : dockerContext.slice('colima-'.length);
  const vmName = profile === 'default' ? 'colima' : `colima-${profile}`;
  const sshConfig = path.join(homedir(), `.colima/_lima/${vmName}/ssh.config`);
  const sshHost = `lima-${vmName}`;

  if (!existsSync(sshConfig)) {
    throw new Error(`Missing Colima SSH config ${sshConfig}.`);
  }

  start('Supabase loopback forward', 'ssh', [
    '-o', 'ControlMaster=no',
    '-o', 'ControlPath=none',
    '-F', sshConfig,
    '-N',
    '-L', '127.0.0.1:54321:127.0.0.1:54321',
    '-L', '127.0.0.1:54322:127.0.0.1:54322',
    sshHost,
  ], { quiet: true });
}

function assertNoTunnel() {
  try {
    execFileSync('pgrep', ['-f', 'zrok'], { stdio: 'ignore' });
    throw new Error('Local mode requires every zrok tunnel to be stopped.');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Local mode')) {
      throw error;
    }
  }
}

function requireZrokSelection(name) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for demo:tunnel.`);
  }

  return value;
}

if (!commandExists('supabase')) {
  throw new Error('Supabase CLI is not installed or not on PATH.');
}

if (mode === 'local') {
  assertNoTunnel();
} else if (!commandExists('zrok2')) {
  throw new Error('zrok2 is required for tunnel mode. Install and enable it before retrying.');
}

prepareRuntimeProject(config);
printNetworkSummary(config);
await ensureLoopbackSupabaseForward();
process.stdout.write('Starting Supabase without Studio, Logflare, or Vector exposure...\n');
let statusText = tryRun('supabase', ['status', '--workdir', runtimeRoot, '-o', 'env']);

if (!statusText) {
  tryRun('supabase', ['stop', '--workdir', runtimeRoot]);
  run('supabase', ['start', '--workdir', runtimeRoot, '-x', 'studio,logflare,vector']);
  statusText = run('supabase', ['status', '--workdir', runtimeRoot, '-o', 'env'], { capture: true });
}

process.stdout.write('Supabase is ready; credentials remain redacted.\n');
if (config.localHost && await canConnect(config.localHost, 54322)) {
  throw new Error('PostgreSQL port 54322 is reachable on the LAN. Disable Docker/Colima automatic port forwarding.');
}
if (config.localHost && await canConnect(config.localHost, 54323)) {
  throw new Error('Supabase Studio port 54323 is reachable on the LAN.');
}
const keys = parseSupabaseStatusEnv(statusText);
writeSelectedPublicEnv(config, keys.anonKey);
writeRuntimeFunctionsEnv(config, keys, env);

start('Edge Functions', 'supabase', [
  'functions',
  'serve',
  '--workdir', runtimeRoot,
  '--no-verify-jwt',
  '--env-file', runtimeFunctionsEnvPath,
]);

const proxyHost = mode === 'local' ? config.localHost : '127.0.0.1';
start('constrained Supabase proxy', process.execPath, ['scripts/lan-supabase-proxy.mjs'], {
  env: {
    FOCACCIA_LAN_PROXY_PORT: '54331',
    FOCACCIA_ALLOWED_BROWSER_ORIGINS: config.browserOrigins.join(','),
    FOCACCIA_LOCAL_HOST: proxyHost,
  },
});

start('organizer web app', 'pnpm', ['--dir', 'apps/web', 'dev', '--hostname', '0.0.0.0']);
start('tickets web app', 'pnpm', ['--dir', 'apps/tickets', 'dev', '--hostname', '0.0.0.0', '--port', '3001']);

if (mode === 'tunnel') {
  start('Supabase zrok share', 'zrok2', [
    'share', 'public', 'http://127.0.0.1:54331',
    '--name-selection', requireZrokSelection('FOCACCIA_ZROK_SUPABASE_NAME_SELECTION'),
  ]);
  start('web zrok share', 'zrok2', [
    'share', 'public', 'http://127.0.0.1:3000',
    '--name-selection', requireZrokSelection('FOCACCIA_ZROK_WEB_NAME_SELECTION'),
  ]);

  start('tickets zrok share', 'zrok2', [
    'share', 'public', 'http://127.0.0.1:3001',
    '--name-selection', requireZrokSelection('FOCACCIA_ZROK_TICKETS_NAME_SELECTION'),
  ]);
}

process.stdout.write([
  '',
  'Runtime env files were generated without printing credentials.',
  'Changing mode or any EXPO_PUBLIC_* value requires stopping Metro and restarting it with --clear.',
  'A native configuration change (including Info.plist/ATS) requires rebuilding the dev client.',
  'Press Ctrl+C to stop demo child processes. Supabase containers remain available for fast restart.',
  '',
].join('\n'));

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

await new Promise((resolve) => {
  process.on('beforeExit', resolve);
});
