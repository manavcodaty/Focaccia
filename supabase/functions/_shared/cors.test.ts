import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCorsHeaders, evaluateCorsRequest } from './cors.ts';

const allowedOrigins = ['http://192.168.1.50:3000', 'http://192.168.1.50:3001'];

test('allows native requests that omit Origin without emitting wildcard CORS', () => {
  const decision = evaluateCorsRequest(new Request('http://localhost/functions/v1/test'), allowedOrigins);

  assert.equal(decision.allowed, true);
  assert.equal(decision.isNative, true);
  assert.equal(buildCorsHeaders(null, allowedOrigins)['Access-Control-Allow-Origin'], undefined);
});

test('reflects an explicitly allowed browser origin', () => {
  const origin = allowedOrigins[0];
  const headers = buildCorsHeaders(origin, allowedOrigins);

  assert.equal(headers['Access-Control-Allow-Origin'], origin);
  assert.equal(headers.Vary, 'Origin');
});

test('rejects unauthorized browser origins', () => {
  const request = new Request('http://localhost/functions/v1/test', {
    headers: { Origin: 'https://attacker.example' },
  });

  assert.deepEqual(evaluateCorsRequest(request, allowedOrigins), {
    allowed: false,
    isNative: false,
    origin: 'https://attacker.example',
  });
});
