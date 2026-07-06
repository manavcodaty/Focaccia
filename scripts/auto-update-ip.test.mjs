import assert from 'node:assert/strict';
import test from 'node:test';

import { updateLocalEnvText } from './auto-update-ip.mjs';

const interfaces = {
  en0: [{
    address: '192.168.1.73',
    family: 'IPv4',
    internal: false,
  }],
};

test('updates the root local IP and keeps Supabase on the constrained proxy', () => {
  const result = updateLocalEnvText([
    'FOCACCIA_NETWORK_MODE=local',
    'FOCACCIA_LOCAL_HOST=192.168.1.20',
    'FOCACCIA_LOCAL_SUPABASE_URL=http://192.168.1.20:54321',
    'FOCACCIA_LOCAL_WEB_URL=http://192.168.1.20:3000',
    'FOCACCIA_LOCAL_TICKETS_URL=http://192.168.1.20:3001',
    '',
  ].join('\n'), interfaces);

  assert.equal(result.changed, true);
  assert.match(result.text, /^FOCACCIA_LOCAL_HOST=192\.168\.1\.73$/m);
  assert.match(result.text, /^FOCACCIA_LOCAL_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
  assert.match(result.text, /^FOCACCIA_LOCAL_WEB_URL=http:\/\/192\.168\.1\.73:3000$/m);
  assert.match(result.text, /^FOCACCIA_LOCAL_TICKETS_URL=http:\/\/192\.168\.1\.73:3001$/m);
});

test('normalizes a stale direct Supabase port even when the IP is still active', () => {
  const result = updateLocalEnvText([
    'FOCACCIA_NETWORK_MODE=local',
    'FOCACCIA_LOCAL_HOST=192.168.1.73',
    'FOCACCIA_LOCAL_SUPABASE_URL=http://192.168.1.73:54321',
    'FOCACCIA_LOCAL_WEB_URL=http://192.168.1.73:3000',
    'FOCACCIA_LOCAL_TICKETS_URL=http://192.168.1.73:3001',
    '',
  ].join('\n'), interfaces);

  assert.equal(result.changed, true);
  assert.match(result.text, /^FOCACCIA_LOCAL_SUPABASE_URL=http:\/\/192\.168\.1\.73:54331$/m);
});
