import type { EnrollmentBundle, PassPayload } from '@face-pass/shared';

export interface ApiErrorShape {
  code: string;
  message: string;
}

export interface EnrollmentPassRecord {
  createdAtIso: string;
  payload: PassPayload;
  queueCode?: string;
  signature: string;
  token: string;
  tokenSnippet: string;
}

export interface FacePoint {
  x: number;
  y: number;
}

export interface FaceBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface FaceSnapshot {
  bounds: FaceBounds;
  faceCount: number;
  frameHeight: number;
  frameWidth: number;
  leftEye: FacePoint;
  pitchAngle: number;
  rightEye: FacePoint;
  rollAngle: number;
  trackedAt: number;
  yawAngle: number;
}

export type CaptureQualityState =
  | 'no-face'
  | 'multiple-faces'
  | 'move-closer'
  | 'center-face'
  | 'hold-still'
  | 'ready';

export interface CaptureQuality {
  canCapture: boolean;
  message: string;
  state: CaptureQualityState;
  tone: 'neutral' | 'success' | 'warning';
}

export interface EnrollmentSessionState {
  bundle: EnrollmentBundle | null;
  consentAccepted: boolean;
  joinCode: string;
  pass: EnrollmentPassRecord | null;
}
