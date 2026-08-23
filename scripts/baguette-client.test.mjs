import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import { CameraWebSocket } from './lib/baguette-client.mjs';

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
