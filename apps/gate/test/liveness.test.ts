import assert from 'node:assert/strict';
import test from 'node:test';

import {
  challengeInstruction,
  effectiveLivenessTimeoutMs,
  hasTimedOut,
  MIN_LIVENESS_TIMEOUT_MS,
  pickChallenge,
} from '../src/lib/liveness.ts';

test('liveness timeout is never shorter than the feasible gate minimum', () => {
  assert.equal(MIN_LIVENESS_TIMEOUT_MS, 20_000);
  assert.equal(effectiveLivenessTimeoutMs(4_000), 20_000);
  assert.equal(effectiveLivenessTimeoutMs(20_000), 20_000);
  assert.equal(effectiveLivenessTimeoutMs(30_000), 30_000);
});

test('timeout checks apply the feasible gate minimum to older provisioned policies', () => {
  const progress = {
    completedAt: null,
    isComplete: false,
    prompt: 'Face the camera, keep your eyes open, and hold still.',
    startedAt: 1_000,
    state: 'center',
    type: 'steady-face',
    value: 0,
  } as const;

  assert.equal(hasTimedOut(progress, 4_000, 20_999), false);
  assert.equal(hasTimedOut(progress, 4_000, 21_001), true);
});

test('manual liveness uses a steady-face capture instead of unmeasured motion prompts', () => {
  assert.equal(pickChallenge(0), 'steady-face');
  assert.equal(pickChallenge(0.5), 'steady-face');
  assert.equal(pickChallenge(0.99), 'steady-face');
  assert.match(challengeInstruction('steady-face'), /Hold still/i);
});
