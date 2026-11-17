import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import { CameraWebSocket, readSimulatorClipboard } from './lib/baguette-client.mjs';

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

test('clipboard reader ignores stale non-token content and tries the second hosted reader',async()=>{
 const calls=[];const value=await readSimulatorClipboard('fixture',{timeoutMs:1000,accept:v=>/^payload[.]signature$/.test(v),readCommand:async(command,args,options)=>{calls.push({command,options});return{stdout:command==='baguette'?'stale fixture value':'payload.signature'};}});
 assert.equal(value,'payload.signature');assert.deepEqual(calls.map(x=>x.command),['baguette','xcrun']);assert.ok(calls.every(x=>x.options.timeout>0&&x.options.timeout<=1000));
});
test('clipboard reader falls back after a reader error and preserves no output on timeout',async()=>{
 const value=await readSimulatorClipboard('fixture',{readCommand:async(command)=>{if(command==='baguette')throw Error('synthetic reader failure');return{stdout:'actual copied fixture'};}});assert.equal(value,'actual copied fixture');
 assert.equal(await readSimulatorClipboard('fixture',{timeoutMs:0,readCommand:()=>{throw Error('Expired read must not run');}}),'');
});
