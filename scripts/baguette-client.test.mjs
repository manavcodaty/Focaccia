import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';

import { CameraWebSocket, tapNode } from './lib/baguette-client.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

test('camera WebSocket parser rejects malformed frames without escaping the promise boundary', async () => {
  const server = net.createServer((socket) => {
    socket.once('data', () => {
      const response = Buffer.from(
        'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
      );
      const malformedJsonFrame = Buffer.from([0x81, 0x01, 0x7b]);
      socket.write(Buffer.concat([response, malformedJsonFrame]));
    });
  });
  const address = await listen(server);
  const websocket = new CameraWebSocket({ host: '127.0.0.1', port: address.port, udid: 'fixture-udid' });

  try {
    await assert.rejects(websocket.connect(), /JSON|Unexpected/);
  } finally {
    websocket.socket?.destroy();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('tapNode can dispatch one protected gesture through an acknowledged input session', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'focaccia-baguette-test-'));
  const fakeBaguette = path.join(tempDir, 'baguette');
  const logPath = path.join(tempDir, 'commands.log');
  const previousPath = process.env.PATH;
  const fakeCommand = `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.BAGUETTE_TEST_LOG, String(args[0]) + '\\n');
if (args[0] === 'describe-ui') {
  process.stdout.write(JSON.stringify({ tree: { frame: { width: 402, height: 874 }, children: [{
    enabled: true,
    hidden: false,
    label: 'Continue',
    role: 'AXButton',
    frame: { x: 20, y: 100, width: 200, height: 52 },
  }] } }));
  process.exit(0);
}
if (args[0] === 'input') {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    for (const line of chunk.split('\\n')) {
      if (line.trim()) process.stdout.write(JSON.stringify({ ok: true }) + '\\n');
    }
  });
}
`;

  await writeFile(fakeBaguette, fakeCommand, { mode: 0o755 });
  await chmod(fakeBaguette, 0o755);
  process.env.BAGUETTE_TEST_LOG = logPath;
  process.env.PATH = `${tempDir}:${previousPath ?? ''}`;

  try {
    const node = await tapNode('fixture-udid', 'Continue', { useInputSession: true });
    assert.equal(node.label, 'Continue');
    const commands = (await readFile(logPath, 'utf8')).trim().split('\n');
    assert.deepEqual(commands, ['describe-ui', 'describe-ui', 'input']);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    delete process.env.BAGUETTE_TEST_LOG;
    await rm(tempDir, { recursive: true, force: true });
  }
});
