import assert from 'node:assert/strict';
import { createLanSupabaseProxy } from '../lan-supabase-proxy.mjs';

export function createObservationRelay({ bindHost, bindPort = 54331, upstreamUrl }) {
  const proxy = createLanSupabaseProxy({ bindHost, bindPort, upstreamUrl });
  const connections = new Set();
  let healthUrl;
  let listening = false;
  proxy.server.on('connection', (socket) => {
    connections.add(socket);
    socket.once('close', () => connections.delete(socket));
  });

  async function probe() {
    return fetch(healthUrl, { cache: 'no-store', headers: { connection: 'close' }, signal: AbortSignal.timeout(3_000) });
  }

  async function requireOnline() {
    const response = await probe();
    assert.equal(response.headers.get('x-focaccia-proxy'), '1', 'Expected the local Focaccia relay');
    assert.ok(response.ok, 'The local Focaccia relay must be reachable before stopping it');
    await response.arrayBuffer();
    return new Date().toISOString();
  }

  async function close() {
    if (!listening) return;
    const closed = proxy.close();
    for (const socket of connections) socket.destroy();
    await closed;
    listening = false;
  }

  return {
    async start() {
      const address = await proxy.listen();
      listening = true;
      healthUrl = `http://${bindHost}:${address.port}/.focaccia/health`;
      await requireOnline();
      return healthUrl;
    },
    async disconnect() {
      const reachableAt = await requireOnline();
      await close();
      await assert.rejects(probe, (error) => error.cause?.code === 'ECONNREFUSED', 'The stopped relay port must refuse connections');
      return {
        network_loss_method: 'stopped_macOS_relay',
        relay_health_available_before_stop_at: reachableAt,
        relay_stop_confirmed: true,
        relay_health_available: false,
        checked_at: new Date().toISOString(),
        physical_radio_isolation: false,
      };
    },
    close,
  };
}
