import { prepareCrypto } from '@face-pass/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { Camera as VisionCamera } from 'react-native-vision-camera';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import {
  createChallenge,
  effectiveLivenessTimeoutMs,
  hasTimedOut,
  pickChallenge,
  type LivenessProgress,
} from '../src/lib/liveness';
import { extractFaceEmbeddingFromPhoto, loadFaceEmbeddingModel } from '../src/lib/embedding-model';
import { cloudE2EFixtureSource, prepareCloudE2EPhoto } from '../src/lib/cloud-e2e-photo';
import { scaleFont, scaleSpacing } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

const isCloudE2E = process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1';

function verificationStatus(isProcessing: boolean, modelReady: boolean): string {
  if (isProcessing) {
    return 'Capturing one verification frame and matching it locally.';
  }

  if (!modelReady) {
    return 'Loading the face model and crypto runtime.';
  }

  return 'Ask the attendee to face the camera, keep their eyes open, and hold still.';
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

function CloudE2EPreview() {
  return (
    <View style={styles.cloudE2EPreview}>
      <Image resizeMode="contain" source={cloudE2EFixtureSource} style={styles.cloudE2EImage} />
      <Text accessibilityLabel="Cloud E2E image source ready" style={styles.cloudE2ELabel}>
        Cloud E2E image source ready
      </Text>
    </View>
  );
}

type LivenessControllerOptions = {
  camera: { current: VisionCamera | null } | null;
  isCloudE2E: boolean;
};

function useLivenessController({
  camera,
  isCloudE2E,
}: LivenessControllerOptions) {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const {
    cancelPendingVerification,
    completePendingVerification,
    failLiveness,
    pendingVerification,
  } = useGate();
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
    // The cloud-only fixture path performs the same local FaceNet/crypto work
    // as production, but a bundled image can take longer than the interactive
    // camera timeout on a hosted simulator. Let that deterministic operation
    // finish; the real camera path keeps the production timeout unchanged.
    if (isCloudE2E || !pendingVerification || isProcessing) {
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
  }, [challenge, failLiveness, isCloudE2E, isProcessing, pendingVerification, router]);

  async function handleVerificationCapture() {
    if ((!isCloudE2E && !camera?.current) || !pendingVerification || !modelReady || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);

    try {
      const photo = isCloudE2E
        ? await prepareCloudE2EPhoto()
        : camera?.current
          ? await camera.current.takePhoto({ enableShutterSound: false })
          : null;
      if (!photo) throw new Error('The camera is not ready.');
      const embedding = await extractFaceEmbeddingFromPhoto({
        photoHeight: photo.height,
        photoPath: photo.path,
        photoWidth: photo.width,
      });

      try {
        const decision = await completePendingVerification(embedding, Date.now() - challenge.startedAt);

        if (decision.reasonCode === 'MATCH_FAIL') {
          setProcessingError(decision.hint);
          setIsProcessing(false);
          return;
        }

        router.replace('/result');
      } finally {
        embedding.fill(0);
      }
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Live matching failed.');
      setIsProcessing(false);
    }
  }

  function cancelVerification() {
    cancelPendingVerification();
    router.replace('/scan');
  }

  return {
    cancelVerification,
    challenge,
    handleVerificationCapture,
    isProcessing,
    layout,
    modelError,
    modelReady,
    pendingVerification,
    processingError,
    router,
  };
}

type LivenessController = ReturnType<typeof useLivenessController>;

function LivenessScreenBody({
  cameraContent,
  controller,
  device,
  hasPermission,
  isCloudE2E,
  requestPermission,
}: {
  cameraContent: ReactNode;
  controller: LivenessController;
  device: unknown;
  hasPermission: boolean;
  isCloudE2E: boolean;
  requestPermission(): void | Promise<unknown>;
}) {
  const {
    cancelVerification,
    challenge,
    handleVerificationCapture,
    isProcessing,
    layout,
    modelError,
    modelReady,
    pendingVerification,
    processingError,
    router,
  } = controller;

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

  if (!device && !isCloudE2E) {
    return (
      <FallbackCard
        body="A rear camera is required for live liveness verification."
        ctaLabel="Back to scanner"
        onPress={() => router.replace('/scan')}
        title="Rear camera unavailable"
      />
    );
  }

  if (!hasPermission && !isCloudE2E) {
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
  const timeoutMs = effectiveLivenessTimeoutMs(
    pendingVerification.event.policy.liveness_timeout_ms,
  );
  const preview = (
    <View
      style={[
        styles.preview,
        previewStyle,
        isCloudE2E ? styles.cloudPreview : null,
        {
          aspectRatio: layout.cameraAspectRatio,
          borderRadius: scaleSpacing(layout, 30, 1.08),
        },
      ]}
    >
      {cameraContent}
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
          <Text style={[styles.processingText, { fontSize: scaleFont(layout, 16) }]}>Running secure match...</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenShell style={styles.screen} variant="scanner">
      {layout.isLandscape ? (
        <View
          style={[
            styles.landscapeShell,
            { gap: scaleSpacing(layout, 18, 1.08), maxWidth: layout.wideContentMaxWidth },
          ]}
        >
          <View style={styles.previewColumn}>{preview}</View>

          <View style={[styles.infoColumn, { gap: scaleSpacing(layout, 16, 1.08) }]}>
            <LivenessHeader layout={layout} />
            <LiveCaptureCard
              challenge={challenge}
              isProcessing={isProcessing}
              layout={layout}
              modelError={modelError}
              modelReady={modelReady}
              processingError={processingError}
              timeoutMs={timeoutMs}
            />
            <LivenessActions
              cancelVerification={cancelVerification}
              handleVerificationCapture={handleVerificationCapture}
              isProcessing={isProcessing}
              modelReady={modelReady}
            />
          </View>
        </View>
      ) : (
        <>
          <LivenessHeader layout={layout} />
          <LiveCaptureCard
            challenge={challenge}
            isProcessing={isProcessing}
            layout={layout}
            modelError={modelError}
            modelReady={modelReady}
            processingError={processingError}
            timeoutMs={timeoutMs}
          />
          {preview}
          <LivenessActions
            cancelVerification={cancelVerification}
            handleVerificationCapture={handleVerificationCapture}
            isProcessing={isProcessing}
            modelReady={modelReady}
          />
        </>
      )}
    </ScreenShell>
  );
}

function LivenessHeader({ layout }: { layout: ReturnType<typeof useResponsiveLayout> }) {
  return (
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
        Hold still for live face matching.
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
        Ask the attendee to face the camera with eyes open. Capture a clear frame while they hold still;
        the gate deletes the temporary image after local matching.
      </Text>
    </View>
  );
}

function LiveCaptureCard({
  challenge,
  isProcessing,
  layout,
  modelError,
  modelReady,
  processingError,
  timeoutMs,
}: {
  challenge: LivenessProgress;
  isProcessing: boolean;
  layout: ReturnType<typeof useResponsiveLayout>;
  modelError: string | null;
  modelReady: boolean;
  processingError: string | null;
  timeoutMs: number;
}) {
  return (
    <SectionCard eyebrow="Live capture" title="Ready for a clear frame">
      <StatusChip label="steady face" tone="warning" />
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
      <MetricRow label="Timeout" value={`${Math.round(timeoutMs / 1000)} seconds`} />
    </SectionCard>
  );
}

function LivenessActions({
  cancelVerification,
  handleVerificationCapture,
  isProcessing,
  modelReady,
}: {
  cancelVerification(): void;
  handleVerificationCapture(): void | Promise<void>;
  isProcessing: boolean;
  modelReady: boolean;
}) {
  return (
    <View style={styles.footerActions}>
      <PrimaryButton
        disabled={!modelReady || isProcessing}
        label={isProcessing ? 'Verifying match...' : 'Capture and verify attendee'}
        onPress={() => {
          void handleVerificationCapture();
        }}
      />
      <PrimaryButton label="Cancel verification" onPress={cancelVerification} tone="ghost" />
    </View>
  );
}

function CloudLivenessScreen() {
  const controller = useLivenessController({ camera: null, isCloudE2E: true });

  return (
    <LivenessScreenBody
      cameraContent={<CloudE2EPreview />}
      controller={controller}
      device={null}
      hasPermission
      isCloudE2E
      requestPermission={() => undefined}
    />
  );
}

function NativeLivenessScreen() {
  // Keep VisionCamera hooks and native camera initialization out of the cloud
  // fixture route. Production continues to use the native camera component.
  const { Camera, useCameraDevice, useCameraPermission } =
    require('react-native-vision-camera') as typeof import('react-native-vision-camera');
  const camera = useRef<VisionCamera>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const controller = useLivenessController({ camera, isCloudE2E: false });

  return (
    <LivenessScreenBody
      cameraContent={
        <Camera
          ref={camera}
          device={device!}
          isActive
          photo
          style={styles.camera}
        />
      }
      controller={controller}
      device={device}
      hasPermission={hasPermission}
      isCloudE2E={false}
      requestPermission={requestPermission}
    />
  );
}

export default function LivenessScreen() {
  return isCloudE2E ? <CloudLivenessScreen /> : <NativeLivenessScreen />;
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  cloudPreview: {
    aspectRatio: 1.45,
    maxHeight: 240,
  },
  cloudE2EImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
  },
  cloudE2ELabel: {
    backgroundColor: palette.ink,
    borderRadius: 999,
    color: palette.textInverse,
    fontSize: 13,
    margin: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  cloudE2EPreview: {
    alignItems: 'center',
    backgroundColor: palette.surfaceInverse,
    flex: 1,
    justifyContent: 'center',
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
