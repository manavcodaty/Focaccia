import type { FaceSnapshot } from './types';

const FACE_MARGIN = 1.8;
const DEFAULT_CROP_RATIO = 0.72;
const DEFAULT_ORIGIN_Y_RATIO = 0.12;
const MIN_CROP_SIZE = 2;

export interface SquareCrop {
  height: number;
  originX: number;
  originY: number;
  width: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function positiveInteger(value: number): number | null {
  if (!Number.isFinite(value) || value < MIN_CROP_SIZE) {
    return null;
  }

  return Math.floor(value);
}

function hasUsableSnapshot(snapshot: FaceSnapshot | null | undefined): snapshot is FaceSnapshot {
  return Boolean(
    snapshot
      && Number.isFinite(snapshot.frameWidth)
      && Number.isFinite(snapshot.frameHeight)
      && snapshot.frameWidth > 0
      && snapshot.frameHeight > 0
      && Number.isFinite(snapshot.bounds.x)
      && Number.isFinite(snapshot.bounds.y)
      && Number.isFinite(snapshot.bounds.width)
      && Number.isFinite(snapshot.bounds.height)
      && snapshot.bounds.width > 0
      && snapshot.bounds.height > 0,
  );
}

export function buildSquareCrop(
  photoWidth: number,
  photoHeight: number,
  snapshot?: FaceSnapshot | null,
): SquareCrop {
  const safePhotoWidth = positiveInteger(photoWidth);
  const safePhotoHeight = positiveInteger(photoHeight);

  if (!safePhotoWidth || !safePhotoHeight) {
    throw new Error('Captured photo dimensions were invalid. Please try again.');
  }

  const maxCropSize = Math.min(safePhotoWidth, safePhotoHeight);
  let cropSize: number;
  let originX: number;
  let originY: number;

  if (hasUsableSnapshot(snapshot)) {
    const widthRatio = safePhotoWidth / snapshot.frameWidth;
    const heightRatio = safePhotoHeight / snapshot.frameHeight;
    const faceWidth = snapshot.bounds.width * widthRatio;
    const faceHeight = snapshot.bounds.height * heightRatio;
    const faceCenterX = (snapshot.bounds.x + snapshot.bounds.width / 2) * widthRatio;
    const faceCenterY = (snapshot.bounds.y + snapshot.bounds.height / 2) * heightRatio;

    cropSize = Math.floor(
      clamp(Math.max(faceWidth, faceHeight) * FACE_MARGIN, MIN_CROP_SIZE, maxCropSize),
    );
    originX = Math.floor(clamp(faceCenterX - cropSize / 2, 0, safePhotoWidth - cropSize));
    originY = Math.floor(clamp(faceCenterY - cropSize * 0.55, 0, safePhotoHeight - cropSize));
  } else {
    cropSize = Math.floor(clamp(maxCropSize * DEFAULT_CROP_RATIO, MIN_CROP_SIZE, maxCropSize));
    originX = Math.floor((safePhotoWidth - cropSize) / 2);
    originY = Math.floor(clamp(safePhotoHeight * DEFAULT_ORIGIN_Y_RATIO, 0, safePhotoHeight - cropSize));
  }

  return {
    height: cropSize,
    originX: clamp(originX, 0, safePhotoWidth - cropSize),
    originY: clamp(originY, 0, safePhotoHeight - cropSize),
    width: cropSize,
  };
}

export function snapshotRollDegrees(snapshot?: FaceSnapshot | null): number | null {
  return hasUsableSnapshot(snapshot) && Number.isFinite(snapshot.rollAngle)
    ? snapshot.rollAngle * -1
    : null;
}
