/// <reference types="expo-router/types" />

declare module '*.tflite' {
  const asset: number;
  export default asset;
}

declare module 'jpeg-js' {
  export interface DecodeOptions {
    useTArray?: boolean;
  }

  export interface DecodedJpeg {
    data: Uint8Array;
    height: number;
    width: number;
  }

  export function decode(
    data: Uint8Array | ArrayBuffer,
    options?: DecodeOptions,
  ): DecodedJpeg;
}
