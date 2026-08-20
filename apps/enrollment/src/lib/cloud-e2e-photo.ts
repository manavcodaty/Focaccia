import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

// This repository-owned fixture is bundled into the native app for the
// hosted-only cloud E2E mode. The production path still uses VisionCamera.
const cloudE2EFixture = require('../../../landing/public/images/peeps/all-peeps.png');
const cloudE2ECrop = { height: 320, originX: 0, originY: 0, width: 320 };

export const cloudE2EFixtureSource = cloudE2EFixture;

export async function prepareCloudE2EPhoto(): Promise<{
  height: number;
  path: string;
  width: number;
}> {
  const source = Image.resolveAssetSource(cloudE2EFixture);
  if (
    !source?.uri
    || !Number.isFinite(source.width)
    || !Number.isFinite(source.height)
    || source.width < cloudE2ECrop.width
    || source.height < cloudE2ECrop.height
  ) {
    throw new Error('The bundled cloud E2E face fixture could not be resolved.');
  }

  // The source is a landing-page sprite sheet. Crop the first avatar so the
  // cloud path supplies a stable face-shaped frame to the normal FaceNet
  // preprocessing instead of the entire design asset.
  const normalized = await manipulateAsync(source.uri, [{ crop: cloudE2ECrop }], {
    compress: 1,
    format: SaveFormat.JPEG,
  });

  return {
    height: cloudE2ECrop.height,
    path: normalized.uri,
    width: cloudE2ECrop.width,
  };
}
