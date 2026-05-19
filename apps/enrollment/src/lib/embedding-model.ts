import { File } from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { decode } from 'jpeg-js';
import faceModelAsset from '../../assets/models/facenet_512.tflite';

import { buildSquareCrop, snapshotRollDegrees } from './face-crop';
import type { FaceSnapshot } from './types';

const FACE_INPUT_SIZE = 160;
const FACE_OUTPUT_SIZE = 512;

let modelPromise: Promise<TensorflowModel> | null = null;

async function deleteFileBestEffort(file: File | null): Promise<void> {
  if (!file) {
    return;
  }

  try {
    await file.delete();
  } catch {
    // Ignore cleanup races if the file is already gone.
  }
}

function zeroArrayView(value: unknown): void {
  const typedValue = value as { fill?: (fillValue: number) => void };

  if (ArrayBuffer.isView(value) && typeof typedValue.fill === 'function') {
    typedValue.fill(0);
  }
}

function ensureFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
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
  snapshot?: FaceSnapshot | null;
}): Promise<Float32Array> {
  const model = await loadFaceEmbeddingModel();
  const photoUri = ensureFileUri(photoPath);
  const sourceFile = new File(photoUri);
  let alignedFile: File | null = null;
  let alignedBytes: Uint8Array | null = null;
  let modelInput: Float32Array | null = null;

  try {
    const crop = buildSquareCrop(photoWidth, photoHeight, snapshot);
    const rollDegrees = snapshotRollDegrees(snapshot);
    const alignedFace = await manipulateAsync(
      photoUri,
      [
        { crop },
        ...(rollDegrees === null ? [] : [{ rotate: rollDegrees }]),
        { resize: { height: FACE_INPUT_SIZE, width: FACE_INPUT_SIZE } },
      ],
      {
        compress: 1,
        format: SaveFormat.JPEG,
      },
    );
    alignedFile = new File(alignedFace.uri);
    alignedBytes = new Uint8Array(await alignedFile.arrayBuffer());
    modelInput = imageBytesToModelInput(alignedBytes);

    try {
      const [output] = await model.run([modelInput]);

      if (!output || output.length !== FACE_OUTPUT_SIZE) {
        throw new Error('Face embedding model returned an unexpected tensor shape.');
      }

      const embedding = output instanceof Float32Array
        ? Float32Array.from(output)
        : Float32Array.from(output as ArrayLike<number>);
      zeroArrayView(output);
      return embedding;
    } finally {
      modelInput.fill(0);
    }
  } finally {
    alignedBytes?.fill(0);
    await deleteFileBestEffort(alignedFile);
    await deleteFileBestEffort(sourceFile);
  }
}
