import type { CaptureQuality, FaceSnapshot } from './types';

const OFF_CENTER_THRESHOLD = 0.18;
const MIN_FACE_WIDTH_RATIO = 0.2;
const MAX_ANGLE = 14;
const STALE_AFTER_MS = 1500;

export function deriveCaptureQuality(
  snapshot: FaceSnapshot | null,
  now = Date.now(),
): CaptureQuality {
  if (!snapshot || now - snapshot.trackedAt > STALE_AFTER_MS) {
    return {
      canCapture: false,
      message: 'Center your face inside the frame to begin.',
      state: 'no-face',
      tone: 'neutral',
    };
  }

  if (snapshot.faceCount > 1) {
    return {
      canCapture: false,
      message: 'Only one person can be in frame during enrollment.',
      state: 'multiple-faces',
      tone: 'warning',
    };
  }

  const faceWidthRatio = snapshot.bounds.width / snapshot.frameWidth;

  if (faceWidthRatio < MIN_FACE_WIDTH_RATIO) {
    return {
      canCapture: false,
      message: 'Move a little closer so your face fills more of the guide.',
      state: 'move-closer',
      tone: 'warning',
    };
  }

  const centerX = snapshot.bounds.x + snapshot.bounds.width / 2;
  const centerY = snapshot.bounds.y + snapshot.bounds.height / 2;
  const offsetX = Math.abs(centerX / snapshot.frameWidth - 0.5);
  const offsetY = Math.abs(centerY / snapshot.frameHeight - 0.5);

  if (offsetX > OFF_CENTER_THRESHOLD || offsetY > OFF_CENTER_THRESHOLD) {
    return {
      canCapture: false,
      message: 'Keep your face centered and level with the guide.',
      state: 'center-face',
      tone: 'warning',
    };
  }

  if (
    Math.abs(snapshot.rollAngle) > MAX_ANGLE
    || Math.abs(snapshot.yawAngle) > MAX_ANGLE
    || Math.abs(snapshot.pitchAngle) > MAX_ANGLE
  ) {
    return {
      canCapture: false,
      message: 'Hold still and face the camera directly for a clean capture.',
      state: 'hold-still',
      tone: 'warning',
    };
  }

  return {
    canCapture: true,
    message: 'Hold still. Your face is aligned and ready.',
    state: 'ready',
    tone: 'success',
  };
}
