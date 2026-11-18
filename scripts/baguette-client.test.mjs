import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import { CameraWebSocket, describeUi, readSimulatorClipboard, redactAccessibilityTree } from './lib/baguette-client.mjs';

test('transient SimulatorKit orientation errors recover with a bounded portrait request', async () => {
  const calls = [];
  const tree = { tree: { label: 'Organizer email' } };
  const readCommand = async (_command, args) => {
    calls.push(args);
    if (calls.length <= 2) throw new Error("SimulatorKit cannot report the screen's interface orientation");
    return { stdout: JSON.stringify(tree) };
  };
  assert.deepEqual(await describeUi('fixture', { readCommand, delay: async () => {}, report: () => {} }), tree);
  assert.deepEqual(calls.map(args => args[0]), ['describe-ui', 'describe-ui', 'orientation', 'describe-ui']);
  assert.equal(calls[2].at(-1), 'portrait');
});

test('persistent orientation errors stop after five reads, and other errors are not retried', async () => {
  for (const [message, expectedReads] of [
    ["SimulatorKit cannot report the screen's interface orientation", 5],
    ['Baguette process exited unexpectedly', 1],
  ]) {
    let reads = 0;
    const readCommand = async (_command, args) => {
      if (args[0] === 'describe-ui') reads += 1;
      throw new Error(message);
    };
    await assert.rejects(describeUi('fixture', { readCommand, delay: async () => {}, report: () => {} }), { message });
    assert.equal(reads, expectedReads);
  }
});

test('diagnostics retain the gate error while excluding entered values and a token embedded in a label', () => {
  const token = `${'x'.repeat(190)}.${'y'.repeat(86)}`;
  const tree = { children: [
    { role: 'AXTextField', label: 'Full pass token', value: token },
    { role: 'AXSecureTextField', label: 'Password', value: 'fixture-secret' },
    { role: 'AXStaticText', label: `Token rejected: ${token}. Refresh revocations successfully.` },
  ] };
  const serialized = JSON.stringify(redactAccessibilityTree(tree));
  assert.ok(serialized.includes('Refresh revocations successfully'));
  assert.ok(serialized.includes('Full pass token'));
  assert.ok(!serialized.includes(token));
  assert.ok(!serialized.includes('fixture-secret'));
  assert.equal(tree.children[0].value, token, 'UI assertions must continue seeing the original test input');
});

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
