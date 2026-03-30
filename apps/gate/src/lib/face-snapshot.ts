import type { Face } from '@ashleysmart/react-native-vision-camera-face-detector';
import type { Frame } from 'react-native-vision-camera';

import type { FaceSnapshot } from './types';

export function toFaceSnapshot(
  faces: Face[],
  frame: Pick<Frame, 'height' | 'width'>,
): FaceSnapshot | null {
  const primary = faces[0];

  if (!primary?.landmarks.LEFT_EYE || !primary.landmarks.RIGHT_EYE) {
    return null;
  }

  return {
    bounds: {
      height: primary.bounds.height,
      width: primary.bounds.width,
      x: primary.bounds.x,
      y: primary.bounds.y,
    },
    faceCount: faces.length,
    frameHeight: frame.height,
    frameWidth: frame.width,
    leftEye: {
      x: primary.landmarks.LEFT_EYE.x,
      y: primary.landmarks.LEFT_EYE.y,
    },
    leftEyeOpenProbability: Number.isFinite(primary.leftEyeOpenProbability)
      ? primary.leftEyeOpenProbability
      : null,
    pitchAngle: primary.pitchAngle,
    rightEye: {
      x: primary.landmarks.RIGHT_EYE.x,
      y: primary.landmarks.RIGHT_EYE.y,
    },
    rightEyeOpenProbability: Number.isFinite(primary.rightEyeOpenProbability)
      ? primary.rightEyeOpenProbability
      : null,
    rollAngle: primary.rollAngle,
    trackedAt: Date.now(),
    yawAngle: primary.yawAngle,
  };
}
