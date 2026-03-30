import { prepareCrypto } from '@face-pass/shared';
import { detectFaces } from '@ashleysmart/react-native-vision-camera-face-detector';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { challengeInstruction, createChallenge, hasTimedOut, pickChallenge, advanceChallenge, type LivenessProgress } from '../src/lib/liveness';
import { extractFaceEmbeddingFromPhoto, loadFaceEmbeddingModel } from '../src/lib/embedding-model';
import type { FaceSnapshot } from '../src/lib/types';
import { useGate } from '../src/state/gate-context';
import { palette } from '../src/theme';

function faceStatus(snapshot: FaceSnapshot | null): string {
  if (!snapshot) {
    return 'Center the attendee inside the frame to begin the active challenge.';
  }

  if (snapshot.faceCount > 1) {
    return 'Only one attendee can be in frame during verification.';
  }

  return 'Tracking face landmarks. Complete the prompt to continue.';
}

function FallbackCard({
  body,
  ctaLabel,
  onPress,
  secondaryAction,
  secondaryLabel,
  title,
}: {
  body: string;
  ctaLabel: string;
  onPress(): void;
  secondaryAction?: () => void;
  secondaryLabel?: string;
  title: string;
}) {
  return (
    <ScreenShell>
      <SectionCard eyebrow="Liveness" title={title}>
        <StatusBanner message={body} tone="warning" />
        <PrimaryButton label={ctaLabel} onPress={onPress} />
        {secondaryAction && secondaryLabel ? (
          <PrimaryButton label={secondaryLabel} onPress={secondaryAction} tone="ghost" />
        ) : null}
      </SectionCard>
    </ScreenShell>
  );
}

export default function LivenessScreen() {
  const router = useRouter();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { completePendingVerification, failLiveness, pendingVerification } = useGate();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [challenge, setChallenge] = useState<LivenessProgress>(() =>
    createChallenge(pickChallenge()));
  const [faceSnapshot, setFaceSnapshot] = useState<FaceSnapshot | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const updateFaceSnapshot = useMemo(
    () => Worklets.createRunOnJS((snapshot: FaceSnapshot | null) => setFaceSnapshot(snapshot)),
    [],
  );
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      const detection = detectFaces({
        frame: frame as never,
        options: {
          classificationMode: 'all',
          landmarkMode: 'all',
          minFaceSize: 0.16,
          performanceMode: 'fast',
        },
      });
      const faces = Object.values(detection.faces);
      const primary = faces[0];

      if (!primary?.landmarks.LEFT_EYE || !primary.landmarks.RIGHT_EYE) {
        updateFaceSnapshot(null);
        return;
      }

      updateFaceSnapshot({
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
      });
    },
    [updateFaceSnapshot],
  );

  useEffect(() => {
    let mounted = true;

    Promise.all([loadFaceEmbeddingModel(), prepareCrypto()])
      .then(() => {
        if (mounted) {
          setModelReady(true);
        }
      })
      .catch((error) => {
        if (mounted) {
          setModelError(error instanceof Error ? error.message : 'Failed to load the face model.');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setChallenge(createChallenge(pickChallenge()));
  }, [pendingVerification?.payload.pass_id]);

  useEffect(() => {
    if (!faceSnapshot || isProcessing) {
      return;
    }

    setChallenge((previous) => advanceChallenge(previous, faceSnapshot, Date.now()));
  }, [faceSnapshot, isProcessing]);

  useEffect(() => {
    if (!pendingVerification || isProcessing) {
      return;
    }

    const interval = setInterval(() => {
      if (hasTimedOut(challenge, pendingVerification.event.policy.liveness_timeout_ms)) {
        setIsProcessing(true);
        setProcessingError(null);

        void failLiveness(Date.now() - challenge.startedAt)
          .then(() => router.replace('/result'))
          .catch((error) => {
            setProcessingError(error instanceof Error ? error.message : 'Liveness failure could not be recorded.');
            setIsProcessing(false);
          });
      }
    }, 250);

    return () => clearInterval(interval);
  }, [challenge, failLiveness, isProcessing, pendingVerification, router]);

  useEffect(() => {
    if (!challenge.isComplete || isProcessing || !faceSnapshot || !modelReady) {
      return;
    }

    async function runVerification() {
      if (!camera.current || !pendingVerification || !faceSnapshot) {
        return;
      }

      setIsProcessing(true);
      setProcessingError(null);

      try {
        const photo = await camera.current.takePhoto({
          enableAutoDistortionCorrection: true,
          enableAutoRedEyeReduction: true,
          enableShutterSound: false,
        });
        const snapshot = faceSnapshot;
        const embedding = await extractFaceEmbeddingFromPhoto({
          photoHeight: photo.height,
          photoPath: photo.path,
          photoWidth: photo.width,
          snapshot,
        });

        try {
          await completePendingVerification(embedding, Date.now() - challenge.startedAt);
          router.replace('/result');
        } finally {
          embedding.fill(0);
        }
      } catch (error) {
        setProcessingError(error instanceof Error ? error.message : 'Live matching failed.');
        setIsProcessing(false);
      }
    }

    void runVerification();
  }, [
    challenge,
    completePendingVerification,
    faceSnapshot,
    isProcessing,
    modelReady,
    pendingVerification,
    router,
  ]);

  if (!pendingVerification) {
    return (
      <FallbackCard
        body="Scan a pass first so the gate has an encrypted template to compare against."
        ctaLabel="Back to scanner"
        onPress={() => router.replace('/scan')}
        title="No pending verification"
      />
    );
  }

  if (!device) {
    return (
      <FallbackCard
        body="A rear camera is required for live liveness verification."
        ctaLabel="Back to scanner"
        onPress={() => router.replace('/scan')}
        title="Rear camera unavailable"
      />
    );
  }

  if (!hasPermission) {
    return (
      <FallbackCard
        body="Camera access is required to complete the active liveness challenge."
        ctaLabel="Allow camera"
        onPress={() => {
          void requestPermission();
        }}
        secondaryAction={() => {
          void Linking.openSettings();
        }}
        secondaryLabel="Open settings"
        title="Camera permission required"
      />
    );
  }

  return (
    <ScreenShell scroll={false} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Liveness</Text>
        <Text style={styles.title}>{challengeInstruction(challenge.type)}</Text>
        <Text style={styles.subtitle}>
          Keep the attendee centered. Once the challenge succeeds, the gate captures one frame,
          generates a live template, deletes the temporary image, and compares locally.
        </Text>
      </View>

      <SectionCard eyebrow="Challenge" title="Active liveness in progress">
        <StatusChip label={challenge.type.replace('-', ' ')} tone="warning" />
        {modelError ? <StatusBanner message={modelError} tone="danger" /> : null}
        {processingError ? <StatusBanner message={processingError} tone="danger" /> : null}
        {!modelReady && !modelError ? (
          <StatusBanner message="Loading the FaceNet model and crypto runtime..." tone="neutral" />
        ) : null}
        <StatusBanner
          message={isProcessing ? 'Liveness confirmed. Verifying match...' : challenge.prompt}
          tone={isProcessing ? 'warning' : 'neutral'}
        />
        <MetricRow label="Status" value={faceStatus(faceSnapshot)} />
        <MetricRow
          label="Timeout"
          value={`${pendingVerification.event.policy.liveness_timeout_ms} ms`}
        />
      </SectionCard>

      <View style={styles.preview}>
        <Camera
          device={device}
          frameProcessor={frameProcessor}
          isActive={!isProcessing}
          photo
          style={styles.camera}
        />
        <View style={styles.overlay} />
        <View style={styles.guide} />
        {isProcessing ? (
          <View style={styles.processingCard}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.processingText}>Running secure match...</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footerActions}>
        <PrimaryButton label="Cancel verification" onPress={() => router.replace('/scan')} tone="ghost" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  eyebrow: {
    color: palette.highlight,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footerActions: {
    gap: 12,
  },
  guide: {
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 4,
    height: '58%',
    left: '16%',
    position: 'absolute',
    top: '18%',
    width: '68%',
  },
  header: {
    gap: 8,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    ...StyleSheet.absoluteFillObject,
  },
  preview: {
    borderRadius: 30,
    flex: 1,
    minHeight: 360,
    overflow: 'hidden',
    position: 'relative',
  },
  processingCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 32, 43, 0.74)',
    borderRadius: 22,
    gap: 10,
    left: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    position: 'absolute',
    right: 24,
    top: 24,
  },
  processingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  screen: {
    gap: 16,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
});
