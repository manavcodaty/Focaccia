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

const BLINK_CLOSED_THRESHOLD = 0.35;
const BLINK_OPEN_THRESHOLD = 0.7;
const CENTER_ANGLE = 10;
const LOOK_UP_TRIGGER = 12;
const TURN_TRIGGER = 18;

function eyeAverage(snapshot: FaceSnapshot): number | null {
  if (
    snapshot.leftEyeOpenProbability === null
    || snapshot.rightEyeOpenProbability === null
  ) {
    return null;
  }

  return (snapshot.leftEyeOpenProbability + snapshot.rightEyeOpenProbability) / 2;
}

export function createChallenge(
  type: LivenessChallengeType,
  now = Date.now(),
): LivenessProgress {
  return {
    completedAt: null,
    isComplete: false,
    prompt:
      type === 'blink-twice'
        ? 'Blink twice while keeping your face centered.'
        : type === 'turn-left'
          ? 'Turn your head left, then return to center.'
          : 'Look up, then return to center.',
    startedAt: now,
    state: 'center',
    type,
    value: 0,
  };
}

export function pickChallenge(seed = Math.random()): LivenessChallengeType {
  if (seed < 1 / 3) {
    return 'blink-twice';
  }

  if (seed < 2 / 3) {
    return 'turn-left';
  }

  return 'look-up';
}

export function challengeInstruction(type: LivenessChallengeType): string {
  switch (type) {
    case 'blink-twice':
      return 'Blink twice while staying in frame.';
    case 'turn-left':
      return 'Turn your head left, then face the camera again.';
    case 'look-up':
      return 'Look up, then face the camera again.';
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

  if (progress.type === 'blink-twice') {
    const openness = eyeAverage(snapshot);

    if (openness === null) {
      return progress;
    }

    if (progress.state === 'center' && openness >= BLINK_OPEN_THRESHOLD) {
      return {
        ...progress,
        prompt: 'Blink twice now.',
        state: 'trigger',
      };
    }

    if (progress.state === 'trigger' && openness <= BLINK_CLOSED_THRESHOLD) {
      return {
        ...progress,
        prompt: progress.value >= 1 ? 'One more blink.' : 'Open your eyes, then blink again.',
        state: 'return',
      };
    }

    if (progress.state === 'return' && openness >= BLINK_OPEN_THRESHOLD) {
      const blinkCount = progress.value + 1;
      const isComplete = blinkCount >= 2;

      return {
        ...progress,
        completedAt: isComplete ? now : null,
        isComplete,
        prompt: isComplete ? 'Liveness confirmed. Matching...' : 'Blink once more.',
        state: isComplete ? 'return' : 'trigger',
        value: blinkCount,
      };
    }

    return progress;
  }

  const actionAngle = progress.type === 'turn-left'
    ? Math.abs(snapshot.yawAngle)
    : Math.abs(snapshot.pitchAngle);
  const triggerThreshold = progress.type === 'turn-left' ? TURN_TRIGGER : LOOK_UP_TRIGGER;

  if (progress.state === 'center' && actionAngle <= CENTER_ANGLE) {
    return {
      ...progress,
      prompt: challengeInstruction(progress.type),
      state: 'trigger',
    };
  }

  if (progress.state === 'trigger' && actionAngle >= triggerThreshold) {
    return {
      ...progress,
      prompt: 'Return to center.',
      state: 'return',
      value: 1,
    };
  }

  if (progress.state === 'return' && progress.value > 0 && actionAngle <= CENTER_ANGLE) {
    return {
      ...progress,
      completedAt: now,
      isComplete: true,
      prompt: 'Liveness confirmed. Matching...',
    };
  }

  return progress;
}

export function hasTimedOut(
  progress: LivenessProgress,
  timeoutMs: number,
  now = Date.now(),
): boolean {
  return now - progress.startedAt > timeoutMs;
}
