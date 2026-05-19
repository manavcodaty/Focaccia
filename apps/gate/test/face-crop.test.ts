import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSquareCrop, snapshotRollDegrees } from '../src/lib/face-crop.ts';
import type { FaceSnapshot } from '../src/lib/types.ts';

function assertCropInsidePhoto(crop: ReturnType<typeof buildSquareCrop>, width: number, height: number): void {
  assert.equal(Number.isInteger(crop.height), true);
  assert.equal(Number.isInteger(crop.originX), true);
  assert.equal(Number.isInteger(crop.originY), true);
  assert.equal(Number.isInteger(crop.width), true);
  assert.equal(crop.width, crop.height);
  assert.equal(crop.width >= 2, true);
  assert.equal(crop.originX >= 0, true);
  assert.equal(crop.originY >= 0, true);
  assert.equal(crop.originX + crop.width <= width, true);
  assert.equal(crop.originY + crop.height <= height, true);
}

test('buildSquareCrop creates integer in-bounds fallback crops', () => {
  const crop = buildSquareCrop(4032.9, 3024.4);

  assertCropInsidePhoto(crop, 4032, 3024);
  assert.equal(crop.width, 2177);
});

test('buildSquareCrop clamps face snapshots at photo edges', () => {
  const snapshot: FaceSnapshot = {
    bounds: {
      height: 230,
      width: 180,
      x: -20,
      y: 10,
    },
    faceCount: 1,
    frameHeight: 720,
    frameWidth: 1280,
    leftEye: { x: 0, y: 0 },
    pitchAngle: 0,
    rightEye: { x: 0, y: 0 },
    rollAngle: 8,
    trackedAt: Date.now(),
    yawAngle: 0,
  };

  const crop = buildSquareCrop(1920, 1080, snapshot);

  assertCropInsidePhoto(crop, 1920, 1080);
  assert.equal(snapshotRollDegrees(snapshot), -8);
});

test('buildSquareCrop rejects invalid photo dimensions before native image processing', () => {
  assert.throws(
    () => buildSquareCrop(Number.NaN, 1080),
    /Captured photo dimensions were invalid/,
  );
  assert.throws(
    () => buildSquareCrop(0, 1080),
    /Captured photo dimensions were invalid/,
  );
});
