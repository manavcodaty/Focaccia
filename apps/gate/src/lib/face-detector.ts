import { requireOptionalNativeModule } from 'expo';

import type { FaceSnapshot } from './types';

export async function detectFace(uri: string): Promise<FaceSnapshot> {
  const detector = requireOptionalNativeModule<{ detect(uri: string): Promise<FaceSnapshot> }>(
    'GateFaceDetector',
  );
  if (!detector) {
    throw new Error('Face detection is unavailable. Rebuild the iOS gate app before verifying attendees.');
  }
  return detector.detect(uri);
}
