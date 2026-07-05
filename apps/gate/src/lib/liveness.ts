import type { FaceSnapshot, LivenessChallengeType } from './types';

export interface LivenessProgress {
  completedAt: number | null;
  isComplete: boolean;
  prompt: string;
  startedAt: number;
  state: 'center' | 'return' | 'trigger';
  type: LivenessChallengeType;
  value: number;
}

export const MIN_LIVENESS_TIMEOUT_MS = 20_000;

export function createChallenge(
  type: LivenessChallengeType,
  now = Date.now(),
): LivenessProgress {
  return {
    completedAt: null,
    isComplete: false,
    prompt: 'Face the camera, keep your eyes open, and hold still.',
    startedAt: now,
    state: 'center',
    type,
    value: 0,
  };
}

export function pickChallenge(_seed = Math.random()): LivenessChallengeType {
  return 'steady-face';
}

export function challengeInstruction(type: LivenessChallengeType): string {
  switch (type) {
    case 'steady-face':
      return 'Hold still for live face matching.';
  }
}

export function advanceChallenge(
  progress: LivenessProgress,
  snapshot: FaceSnapshot | null,
  now = Date.now(),
): LivenessProgress {
  if (!snapshot || progress.isComplete) {
    return progress;
  }

  if (progress.type === 'steady-face') {
    const isComplete = snapshot.faceCount === 1;

    return {
      ...progress,
      completedAt: isComplete ? now : null,
      isComplete,
      prompt: isComplete
        ? 'Liveness confirmed. Matching...'
        : 'Keep exactly one face centered in the frame.',
      state: isComplete ? 'return' : 'center',
    };
  }

  return progress;
}

export function hasTimedOut(
  progress: LivenessProgress,
  timeoutMs: number,
  now = Date.now(),
): boolean {
  return now - progress.startedAt > effectiveLivenessTimeoutMs(timeoutMs);
}

export function effectiveLivenessTimeoutMs(timeoutMs: number): number {
  return Math.max(timeoutMs, MIN_LIVENESS_TIMEOUT_MS);
}
