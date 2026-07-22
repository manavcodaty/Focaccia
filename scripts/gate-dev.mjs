import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { prepareGateNetwork } from './gate-network-bootstrap.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const gateRoot = path.join(repoRoot, 'apps/gate');

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
  child.on('error', (error) => {
    process.stderr.write(`${label} failed to start: ${error.message}.\n`);
  });

  return child;
}

async function startGateDev() {
  const children = [];
  const stopChildren = (signal) => {
    for (const child of [...children].reverse()) {
      if (!child.killed) child.kill(signal);
    }
  };

  try {
    const { host, mode, proxy } = await prepareGateNetwork();
    if (proxy) children.push(proxy);

    const extraArgs = process.argv.slice(2).filter((argument) => argument !== '--');
    const clearArgs = mode === 'local' && !extraArgs.includes('--clear') ? ['--clear'] : [];
    const expo = start('gate Metro server', 'pnpm', [
      'exec',
      'expo',
      'start',
      '--dev-client',
      '--host',
      'lan',
      ...clearArgs,
      ...extraArgs,
    ], {
      cwd: gateRoot,
      env: host ? { REACT_NATIVE_PACKAGER_HOSTNAME: host } : undefined,
    });
    children.push(expo);

    expo.once('error', () => stopChildren('SIGTERM'));
    expo.on('exit', (code) => {
      stopChildren('SIGTERM');
      process.exitCode = code ?? 0;
    });
  } catch (error) {
    stopChildren('SIGTERM');
    throw error;
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      stopChildren(signal);
      process.exitCode = 0;
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startGateDev().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Gate dev startup failed.'}\n`);
    process.exitCode = 1;
  });
}
