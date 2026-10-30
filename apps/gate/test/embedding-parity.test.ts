import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import * as enrollmentCrop from '../../enrollment/src/lib/face-crop.ts';
import { buildSquareCrop, snapshotRollDegrees } from '../src/lib/face-crop.ts';

// Exercise the real extraction functions; only native image I/O and inference are substituted.
function extractor(app: 'gate' | 'enrollment', detectionFails = false) {
  const actions: unknown[] = [];
  const deleted: string[] = [];
  const inputs: Float32Array[] = [];
  const snapshot = {
    bounds: { x: 300, y: 400, width: 250, height: 350 },
    frameWidth: 1200, frameHeight: 1600, rollAngle: 8,
  };
  const modules: Record<string, unknown> = {
    'expo-file-system': { File: class {
      readonly uri: string;
      constructor(uri: string) { this.uri = uri; }
      async delete() { deleted.push(this.uri); }
      async arrayBuffer() { return new ArrayBuffer(8); }
    } },
    'expo-image-manipulator': {
      SaveFormat: { JPEG: 'jpeg' },
      async manipulateAsync(_uri: string, transforms: unknown[]) {
        actions.push(transforms);
        return { uri: `file://processed-${actions.length}`, width: 1200, height: 1600 };
      },
    },
    'jpeg-js': { decode: () => ({
      width: 160, height: 160,
      data: new Uint8Array(160 * 160 * 4).fill(128),
    }) },
    'react-native-fast-tflite': { loadTensorflowModel: async () => ({
      async run([input]: Float32Array[]) {
        inputs.push(input.slice());
        return [new Float32Array(512).fill(1)];
      },
    }) },
    './face-crop': app === 'enrollment' ? enrollmentCrop : { buildSquareCrop, snapshotRollDegrees },
    './face-detector': { async detectFace() {
      if (detectionFails) throw new Error('Keep exactly one clear face in the frame.');
      return snapshot;
    } },
  };
  const source = readFileSync(new URL(`../../${app}/src/lib/embedding-model.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: { extractFaceEmbeddingFromPhoto?: (photo: object) => Promise<Float32Array> } = {};
  runInNewContext(compiled, {
    exports, Float32Array, Uint8Array, ArrayBuffer,
    require: (name: string) => {
      if (name.endsWith('.tflite')) return 'same-model';
      assert.ok(name in modules, `Unexpected native dependency: ${name}`);
      return modules[name];
    },
  });
  return { extract: exports.extractFaceEmbeddingFromPhoto!, actions, deleted, inputs };
}

test('enrollment and gate use identical upright guide crops and RGB model inputs', async () => {
  const enrollment = extractor('enrollment');
  const gate = extractor('gate');
  // Raw dimensions may be landscape even though EXIF makes the photo portrait.
  const photo = { photoWidth: 1600, photoHeight: 1200, photoPath: '/capture.jpg' };
  await enrollment.extract(photo);
  await gate.extract(photo);
  assert.deepEqual(JSON.parse(JSON.stringify(gate.actions)), JSON.parse(JSON.stringify(enrollment.actions)));
  assert.deepEqual(JSON.parse(JSON.stringify(gate.actions)), [
    [], [{ crop: buildSquareCrop(1200, 1600) }, { resize: { height: 160, width: 160 } }],
  ]);
  assert.deepEqual(gate.inputs, enrollment.inputs);
  assert.deepEqual(gate.deleted.sort(), enrollment.deleted.sort());
});

test('gate still refuses invalid face detection before inference and deletes photos', async () => {
  const gate = extractor('gate', true);
  await assert.rejects(gate.extract({ photoWidth: 1200, photoHeight: 1600, photoPath: '/capture.jpg' }), /one clear face/);
  assert.equal(gate.inputs.length, 0);
  assert.deepEqual(gate.deleted.sort(), ['file:///capture.jpg', 'file://processed-1']);
});
