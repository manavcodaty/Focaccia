import { prepareCrypto } from '@face-pass/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
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
import { scaleFont, scaleSpacing } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

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
  const layout = useResponsiveLayout();
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

  const previewStyle = layout.isLandscape
    ? {
        width: Math.min(
          layout.cameraFrameMaxWidth,
          layout.shortSide * (layout.isTablet ? 0.82 : 0.88),
        ),
      }
    : {
        maxWidth: layout.cameraFrameMaxWidth,
        width: '100%' as const,
      };
  const guideStyle: ViewStyle = {
    borderRadius: scaleSpacing(layout, 999, 1),
    height: layout.isLandscape ? '56%' : '58%',
    left: layout.isLandscape ? '18%' : '16%',
    top: layout.isLandscape ? '20%' : '18%',
    width: layout.isLandscape ? '64%' : '68%',
  };

  return (
    <ScreenShell scroll={false} style={styles.screen} variant="wide">
      {layout.isLandscape ? (
        <View
          style={[
            styles.landscapeShell,
            { gap: scaleSpacing(layout, 18, 1.08), maxWidth: layout.wideContentMaxWidth },
          ]}
        >
          <View style={styles.previewColumn}>
            <View
              style={[
                styles.preview,
                previewStyle,
                {
                  aspectRatio: layout.cameraAspectRatio,
                  borderRadius: scaleSpacing(layout, 30, 1.08),
                },
              ]}
            >
              <Camera
                device={device}
                isActive={!isProcessing}
                photo
                style={styles.camera}
              />
              <View style={styles.overlay} />
              <View style={[styles.guide, guideStyle]} />
              {isProcessing ? (
                <View
                  style={[
                    styles.processingCard,
                    {
                      borderRadius: scaleSpacing(layout, 22, 1.08),
                      left: scaleSpacing(layout, 24, 1.06),
                      paddingHorizontal: scaleSpacing(layout, 18, 1.06),
                      paddingVertical: scaleSpacing(layout, 16, 1.06),
                      right: scaleSpacing(layout, 24, 1.06),
                      top: scaleSpacing(layout, 24, 1.06),
                    },
                  ]}
                >
                  <ActivityIndicator color={palette.textInverse} />
                  <Text style={[styles.processingText, { fontSize: scaleFont(layout, 16) }]}>
                    Running secure match...
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={[styles.infoColumn, { gap: scaleSpacing(layout, 16, 1.08) }]}>
            <View style={styles.header}>
              <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 12) }]}>Liveness</Text>
              <Text
                style={[
                  styles.title,
                  {
                    fontSize: scaleFont(layout, 30, 1.12),
                    lineHeight: scaleFont(layout, 34, 1.12),
                  },
                ]}
              >
                {challengeInstruction(challenge.type)}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  {
                    fontSize: scaleFont(layout, 15),
                    lineHeight: scaleFont(layout, 22),
                  },
                ]}
              >
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
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 12) }]}>Liveness</Text>
            <Text
              style={[
                styles.title,
                {
                  fontSize: scaleFont(layout, 30, 1.12),
                  lineHeight: scaleFont(layout, 34, 1.12),
                },
              ]}
            >
              {challengeInstruction(challenge.type)}
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  fontSize: scaleFont(layout, 15),
                  lineHeight: scaleFont(layout, 22),
                },
              ]}
            >
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

          <View
            style={[
              styles.preview,
              previewStyle,
              {
                aspectRatio: layout.cameraAspectRatio,
                borderRadius: scaleSpacing(layout, 30, 1.08),
              },
            ]}
          >
            <Camera
              device={device}
              isActive={!isProcessing}
              photo
              style={styles.camera}
            />
            <View style={styles.overlay} />
            <View style={[styles.guide, guideStyle]} />
            {isProcessing ? (
              <View
                style={[
                  styles.processingCard,
                  {
                    borderRadius: scaleSpacing(layout, 22, 1.08),
                    left: scaleSpacing(layout, 24, 1.06),
                    paddingHorizontal: scaleSpacing(layout, 18, 1.06),
                    paddingVertical: scaleSpacing(layout, 16, 1.06),
                    right: scaleSpacing(layout, 24, 1.06),
                    top: scaleSpacing(layout, 24, 1.06),
                  },
                ]}
              >
                <ActivityIndicator color={palette.textInverse} />
                <Text style={[styles.processingText, { fontSize: scaleFont(layout, 16) }]}>
                  Running secure match...
                </Text>
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
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  eyebrow: {
    ...typography.title,
    color: palette.highlight,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footerActions: {
    gap: 12,
  },
  guide: {
    borderColor: palette.scanFrame,
    borderWidth: 4,
    position: 'absolute',
  },
  header: {
    gap: 8,
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 360,
  },
  landscapeShell: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  overlay: {
    backgroundColor: palette.overlay,
    ...StyleSheet.absoluteFillObject,
  },
  preview: {
    alignSelf: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  previewColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  processingCard: {
    alignItems: 'center',
    backgroundColor: palette.surfaceInverseSoft,
    gap: 10,
    position: 'absolute',
  },
  processingText: {
    ...typography.display,
    color: palette.textInverse,
  },
  screen: {
    gap: 16,
  },
  subtitle: {
    ...typography.body,
    color: palette.muted,
  },
  title: {
    ...typography.display,
    color: palette.ink,
  },
});
