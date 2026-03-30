import { File } from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import faceModelAsset from '../../../enrollment/assets/models/facenet_512.tflite';

import type { FaceSnapshot } from './types';

const FACE_INPUT_SIZE = 160;
const FACE_OUTPUT_SIZE = 512;
const FACE_MARGIN = 1.8;

let modelPromise: Promise<TensorflowModel> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function ensureFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function buildSquareCrop(
  photoWidth: number,
  photoHeight: number,
  snapshot: FaceSnapshot,
): { height: number; originX: number; originY: number; width: number } {
  const widthRatio = photoWidth / snapshot.frameWidth;
  const heightRatio = photoHeight / snapshot.frameHeight;
  const faceWidth = snapshot.bounds.width * widthRatio;
  const faceHeight = snapshot.bounds.height * heightRatio;
  const faceCenterX = (snapshot.bounds.x + snapshot.bounds.width / 2) * widthRatio;
  const faceCenterY = (snapshot.bounds.y + snapshot.bounds.height / 2) * heightRatio;
  const cropSize = Math.min(
    Math.max(faceWidth, faceHeight) * FACE_MARGIN,
    photoWidth,
    photoHeight,
  );
  const originX = clamp(faceCenterX - cropSize / 2, 0, photoWidth - cropSize);
  const originY = clamp(faceCenterY - cropSize * 0.55, 0, photoHeight - cropSize);

  return {
    height: cropSize,
    originX,
    originY,
    width: cropSize,
  };
}

function imageBytesToModelInput(bytes: Uint8Array): Float32Array {
  const decoded = decode(bytes, { useTArray: true });

  if (decoded.width !== FACE_INPUT_SIZE || decoded.height !== FACE_INPUT_SIZE) {
    throw new Error('Aligned face image did not match the expected model input size.');
  }

  const input = new Float32Array(FACE_INPUT_SIZE * FACE_INPUT_SIZE * 3);

  for (let pixelIndex = 0; pixelIndex < FACE_INPUT_SIZE * FACE_INPUT_SIZE; pixelIndex += 1) {
    const rgbaOffset = pixelIndex * 4;
    const rgbOffset = pixelIndex * 3;

    input[rgbOffset] = (decoded.data[rgbaOffset] ?? 0) / 255;
    input[rgbOffset + 1] = (decoded.data[rgbaOffset + 1] ?? 0) / 255;
    input[rgbOffset + 2] = (decoded.data[rgbaOffset + 2] ?? 0) / 255;
  }

  decoded.data.fill(0);

  return input;
}

export async function loadFaceEmbeddingModel(): Promise<TensorflowModel> {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(faceModelAsset, 'core-ml').catch(() =>
      loadTensorflowModel(faceModelAsset, 'default'));
  }

  return modelPromise;
}

export async function extractFaceEmbeddingFromPhoto({
  photoHeight,
  photoPath,
  photoWidth,
  snapshot,
}: {
  photoHeight: number;
  photoPath: string;
  photoWidth: number;
  snapshot: FaceSnapshot;
}): Promise<Float32Array> {
  const model = await loadFaceEmbeddingModel();
  const photoUri = ensureFileUri(photoPath);
  const sourceFile = new File(photoUri);

  try {
    const crop = buildSquareCrop(photoWidth, photoHeight, snapshot);
    const alignedFace = await manipulateAsync(
      photoUri,
      [
        { crop },
        { rotate: snapshot.rollAngle * -1 },
        { resize: { height: FACE_INPUT_SIZE, width: FACE_INPUT_SIZE } },
      ],
      {
        compress: 1,
        format: SaveFormat.JPEG,
      },
    );
    const alignedFile = new File(alignedFace.uri);
    const alignedBytes = new Uint8Array(await alignedFile.arrayBuffer());
    const modelInput = imageBytesToModelInput(alignedBytes);

    alignedBytes.fill(0);
    alignedFile.delete();

    try {
      const [output] = await model.run([modelInput]);

      if (!output || output.length !== FACE_OUTPUT_SIZE) {
        throw new Error('Face embedding model returned an unexpected tensor shape.');
      }

      return output instanceof Float32Array
        ? Float32Array.from(output)
        : Float32Array.from(output as ArrayLike<number>);
    } finally {
      modelInput.fill(0);
    }
  } finally {
    sourceFile.delete();
  }
}
