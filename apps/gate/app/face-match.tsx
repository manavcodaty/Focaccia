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
import { extractFaceEmbeddingFromPhoto, loadFaceEmbeddingModel } from '../src/lib/embedding-model';
import { scaleFont, scaleSpacing } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

function verificationStatus(isProcessing: boolean, modelReady: boolean): string {
  if (isProcessing) {
    return 'Comparing face with the pass…';
  }

  if (!modelReady) {
    return 'Loading the face model and crypto runtime.';
  }

  return 'Ready to capture.';
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
      <SectionCard eyebrow="Face match" title={title}>
        <StatusBanner message={body} tone="warning" />
        <PrimaryButton label={ctaLabel} onPress={onPress} />
        {secondaryAction && secondaryLabel ? (
          <PrimaryButton label={secondaryLabel} onPress={secondaryAction} tone="ghost" />
        ) : null}
      </SectionCard>
    </ScreenShell>
  );
}

export default function FaceMatchScreen() {
  const router = useRouter();
  const camera = useRef<Camera>(null);
  const captureInFlight = useRef(false);
  const captureStartedAt = useRef(Date.now());
  const verificationGeneration = useRef(0);
  const device = useCameraDevice('back');
  const layout = useResponsiveLayout();
  const {
    cancelPendingVerification,
    completePendingVerification,
    pendingVerification,
  } = useGate();
  const { hasPermission, requestPermission } = useCameraPermission();
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
    captureStartedAt.current = Date.now();
    return () => { verificationGeneration.current += 1; };
  }, [pendingVerification?.payload.pass_id]);

  async function handleVerificationCapture() {
    if (!camera.current || !pendingVerification || !modelReady || captureInFlight.current || isProcessing) {
      return;
    }

    captureInFlight.current = true;
    const generation = verificationGeneration.current;
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const photo = await camera.current.takePhoto({
        enableShutterSound: false,
      });
      const embedding = await extractFaceEmbeddingFromPhoto({
        photoHeight: photo.height,
        photoPath: photo.path,
        photoWidth: photo.width,
      });

      try {
        if (generation !== verificationGeneration.current) return;
        // The match decides entry: accepted or rejected, both outcomes go to the result screen.
        await completePendingVerification(embedding, Date.now() - captureStartedAt.current);
        router.replace('/result');
      } finally {
        embedding.fill(0);
      }
    } catch (error) {
      if (generation !== verificationGeneration.current) return;
      // No decision was made (e.g. no single clear face); the operator can capture again.
      setProcessingError(error instanceof Error ? error.message : 'Face capture failed. Try again.');
      setIsProcessing(false);
    } finally {
      captureInFlight.current = false;
    }
  }

  function cancelVerification() {
    verificationGeneration.current += 1;
    cancelPendingVerification();
    router.replace('/scan');
  }

  if (!pendingVerification) {
    return (
      <FallbackCard
        body="Scan a pass first."
        ctaLabel="Back to scanner"
        onPress={() => router.replace('/scan')}
        title="No pending verification"
      />
    );
  }

  if (!device) {
    return (
      <FallbackCard
        body="Rear camera required."
        ctaLabel="Back to scanner"
        onPress={() => router.replace('/scan')}
        title="Rear camera unavailable"
      />
    );
  }

  if (!hasPermission) {
    return (
      <FallbackCard
        body="Allow camera access to verify entry."
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
    <ScreenShell style={styles.screen} variant="scanner">
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
                ref={camera}
                device={device}
                isActive={true}
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
              <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 12) }]}>Face match</Text>
              <Text
                style={[
                  styles.title,
                  {
                    fontSize: scaleFont(layout, 30, 1.12),
                    lineHeight: scaleFont(layout, 34, 1.12),
                  },
                ]}
              >
                Scan the attendee's face.
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
                Ask the attendee to look at the camera, then capture. The gate compares the face with the person who enrolled this pass.
              </Text>
            </View>

            <SectionCard eyebrow="Live capture" title="Ready for a clear frame">
              <StatusChip label="single face capture" tone="neutral" />
              {modelError ? <StatusBanner message={modelError} tone="danger" /> : null}
              {processingError ? <StatusBanner message={processingError} tone="danger" /> : null}
              {!modelReady && !modelError ? (
                <StatusBanner message="Loading the FaceNet model and crypto runtime..." tone="neutral" />
              ) : null}
              <StatusBanner
                message={isProcessing ? 'Comparing face with the pass...' : 'Center one face in the guide, then capture.'}
                tone={isProcessing ? 'warning' : 'neutral'}
              />
              <MetricRow label="Mode" value="Face match against the pass" />
              <MetricRow label="Status" value={verificationStatus(isProcessing, modelReady)} />
            </SectionCard>

            <View style={styles.footerActions}>
              <PrimaryButton
                disabled={!modelReady || isProcessing}
                label={isProcessing ? 'Verifying match...' : 'Capture face'}
                onPress={() => {
                  void handleVerificationCapture();
                }}
              />
              <PrimaryButton label="Cancel verification" onPress={cancelVerification} tone="ghost" />
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 12) }]}>Face match</Text>
            <Text
              style={[
                styles.title,
                {
                  fontSize: scaleFont(layout, 30, 1.12),
                  lineHeight: scaleFont(layout, 34, 1.12),
                },
              ]}
            >
              Scan the attendee's face.
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
              Ask the attendee to look at the camera, then capture. The gate compares the face with the person who enrolled this pass.
            </Text>
          </View>

          <SectionCard eyebrow="Live capture" title="Ready for a clear frame">
            <StatusChip label="single face capture" tone="neutral" />
            {modelError ? <StatusBanner message={modelError} tone="danger" /> : null}
            {processingError ? <StatusBanner message={processingError} tone="danger" /> : null}
            {!modelReady && !modelError ? (
              <StatusBanner message="Loading the FaceNet model and crypto runtime..." tone="neutral" />
            ) : null}
            <StatusBanner
              message={isProcessing ? 'Comparing face with the pass...' : 'Center one face in the guide, then capture.'}
              tone={isProcessing ? 'warning' : 'neutral'}
            />
            <MetricRow label="Mode" value="Face match against the pass" />
            <MetricRow label="Status" value={verificationStatus(isProcessing, modelReady)} />
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
              ref={camera}
              device={device}
              isActive={true}
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
              label={isProcessing ? 'Verifying match...' : 'Capture face'}
              onPress={() => {
                void handleVerificationCapture();
              }}
            />
            <PrimaryButton label="Cancel verification" onPress={cancelVerification} tone="ghost" />
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
    color: palette.warmMist,
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
    color: palette.textInverseMuted,
  },
  title: {
    ...typography.display,
    color: palette.textInverse,
  },
});
