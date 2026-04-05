import { prepareCrypto } from '@face-pass/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
} from 'react-native-vision-camera';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { challengeInstruction, createChallenge, hasTimedOut, pickChallenge, type LivenessProgress } from '../src/lib/liveness';
import { extractFaceEmbeddingFromPhoto, loadFaceEmbeddingModel } from '../src/lib/embedding-model';
import { useGate } from '../src/state/gate-context';
import { palette } from '../src/theme';

function verificationStatus(isProcessing: boolean, modelReady: boolean): string {
  if (isProcessing) {
    return 'Capturing one verification frame and matching it locally.';
  }

  if (!modelReady) {
    return 'Loading the face model and crypto runtime.';
  }

  return 'Ask the attendee to complete the prompt, then capture when ready.';
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
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  async function handleVerificationCapture() {
    if (!camera.current || !pendingVerification || !modelReady || isProcessing) {
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
      const embedding = await extractFaceEmbeddingFromPhoto({
        photoHeight: photo.height,
        photoPath: photo.path,
        photoWidth: photo.width,
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
          Ask the attendee to complete the prompt, then capture one verification frame. The gate
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
        <MetricRow label="Mode" value="Manual capture confirmation" />
        <MetricRow label="Status" value={verificationStatus(isProcessing, modelReady)} />
        <MetricRow
          label="Timeout"
          value={`${pendingVerification.event.policy.liveness_timeout_ms} ms`}
        />
      </SectionCard>

      <View style={styles.preview}>
        <Camera
          device={device}
          isActive={!isProcessing}
          photo
          style={styles.camera}
        />
        <View style={styles.overlay} />
        <View style={styles.guide} />
        {isProcessing ? (
          <View style={styles.processingCard}>
            <ActivityIndicator color={palette.textInverse} />
            <Text style={styles.processingText}>Running secure match...</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footerActions}>
        <PrimaryButton
          disabled={!modelReady || isProcessing}
          label={isProcessing ? 'Verifying match...' : 'Capture and verify attendee'}
          onPress={() => {
            void handleVerificationCapture();
          }}
        />
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
    borderColor: palette.scanFrame,
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
    backgroundColor: palette.overlay,
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
    backgroundColor: palette.surfaceInverseSoft,
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
    color: palette.textInverse,
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
