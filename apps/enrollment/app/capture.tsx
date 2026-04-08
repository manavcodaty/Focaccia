import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { prepareCrypto } from '@face-pass/shared';

import { requestPassSignature } from '../src/lib/api';
import { extractFaceEmbeddingFromPhoto, loadFaceEmbeddingModel } from '../src/lib/embedding-model';
import { issueSignedPassFromEmbedding, tokenSnippet, type PassProcessingPhase } from '../src/lib/pass-flow';
import { scaleFont, scaleSpacing } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, typography } from '../src/theme';
import { CameraGuide } from '../src/components/camera-guide';
import { PrimaryButton } from '../src/components/primary-button';
import { StatusBanner } from '../src/components/status-banner';

function phaseLabel(phase: PassProcessingPhase | null): string {
  switch (phase) {
    case 'generating-template':
      return 'Generating secure face template';
    case 'encrypting-pass':
      return 'Encrypting pass data';
    case 'requesting-signature':
      return 'Requesting server signature';
    case 'finalizing-pass':
      return 'Finalizing pass';
    default:
      return 'Preparing face';
  }
}

export default function CaptureScreen() {
  const router = useRouter();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('front');
  const layout = useResponsiveLayout();
  const { hasPermission, requestPermission } = useCameraPermission();
  const { setPass, state } = useEnrollment();
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<PassProcessingPhase | null>(null);
  const quality = {
    canCapture: modelReady,
    message: modelReady
      ? 'Align your face inside the guide, then capture when ready.'
      : 'Center your face inside the guide while the face model loads.',
    tone: modelReady ? 'success' : 'neutral',
  } as const;

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

  if (!state.bundle) {
    return (
      <FallbackCard
        body="The event bundle is missing. Start from the join code screen."
        ctaLabel="Back to join code"
        onPress={() => router.replace('/')}
        title="Enrollment session missing"
      />
    );
  }

  if (!state.consentAccepted) {
    return (
      <FallbackCard
        body="Camera capture only starts after consent. Review the privacy screen first."
        ctaLabel="Review consent"
        onPress={() => router.replace('/consent')}
        title="Consent required"
      />
    );
  }

  if (!device) {
    return (
      <FallbackCard
        body="A front camera could not be found on this device."
        ctaLabel="Open help"
        onPress={() => router.push('/help')}
        title="Front camera unavailable"
      />
    );
  }

  if (!hasPermission) {
    return (
      <FallbackCard
        body="Camera access is required to capture your face on-device and issue the pass."
        ctaLabel="Allow camera"
        onPress={() => {
          void requestPermission();
        }}
        secondaryAction={() => Linking.openSettings()}
        secondaryLabel="Open settings"
        title="Camera permission required"
      />
    );
  }

  async function handleCapture() {
    if (!camera.current || !quality.canCapture || !state.bundle) {
      return;
    }

    setCaptureError(null);
    setIsProcessing(true);
    setProcessingPhase(null);

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
        const result = await issueSignedPassFromEmbedding({
          bundle: state.bundle,
          embedding,
          issuePass: (payload) => requestPassSignature(state.joinCode, payload),
          onPhaseChange: setProcessingPhase,
        });

        const passRecord = {
          createdAtIso: new Date().toISOString(),
          payload: result.payload,
          signature: result.signature,
          token: result.token,
          tokenSnippet: tokenSnippet(result.token),
        };

        if (result.queueCode) {
          Object.assign(passRecord, { queueCode: result.queueCode });
        }

        setPass(passRecord);
        result.template.fill(0);
        router.replace('/pass');
      } finally {
        embedding.fill(0);
      }
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Pass issuance failed.');
    } finally {
      setIsProcessing(false);
      setProcessingPhase(null);
    }
  }

  const cameraStageStyle = layout.isLandscape
    ? {
        width: Math.min(
          layout.cameraFrameMaxWidth,
          layout.shortSide * (layout.isTablet ? 0.78 : 0.8),
        ),
      }
    : {
        maxWidth: layout.cameraFrameMaxWidth,
        width: '100%' as const,
      };
  const panelPadding = scaleSpacing(layout, 20, 1.1);
  const titleFontSize = scaleFont(layout, 28, 1.12);
  const titleLineHeight = scaleFont(layout, 34, 1.12);
  const subtitleFontSize = scaleFont(layout, 15);
  const subtitleLineHeight = scaleFont(layout, 21);

  return (
    <View style={styles.captureScreen}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <View
          style={[
            styles.captureLayout,
            {
              gap: layout.sectionGap,
              paddingHorizontal: layout.horizontalPadding,
              paddingVertical: layout.verticalPadding,
            },
          ]}
        >
          {layout.isLandscape ? (
            <View
              style={[
                styles.landscapeShell,
                { gap: scaleSpacing(layout, 18, 1.08), maxWidth: layout.wideContentMaxWidth },
              ]}
            >
              <View style={styles.cameraColumn}>
                <View
                  style={[
                    styles.cameraStage,
                    cameraStageStyle,
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
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.cameraTint} />
                  <CameraGuide ready={quality.canCapture && !isProcessing} />
                </View>
              </View>

              <View style={[styles.sideColumn, { gap: scaleSpacing(layout, 16, 1.08) }]}>
                <View
                  style={[
                    styles.topPanel,
                    {
                      borderRadius: scaleSpacing(layout, 24, 1.08),
                      padding: panelPadding,
                    },
                  ]}
                >
                  <Text style={[styles.topEyebrow, { fontSize: scaleFont(layout, 12) }]}>Capture</Text>
                  <Text
                    style={[
                      styles.topTitle,
                      { fontSize: titleFontSize, lineHeight: titleLineHeight },
                    ]}
                  >
                    Align your face with the guide.
                  </Text>
                  <Text
                    style={[
                      styles.topSubtitle,
                      {
                        fontSize: subtitleFontSize,
                        lineHeight: subtitleLineHeight,
                      },
                    ]}
                  >
                    We only keep enough information in memory to issue the pass for {state.bundle.event_id}.
                  </Text>
                </View>

                <View
                  style={[
                    styles.bottomPanel,
                    {
                      borderRadius: scaleSpacing(layout, 24, 1.08),
                      gap: scaleSpacing(layout, 12, 1.05),
                      padding: panelPadding,
                    },
                  ]}
                >
                  {modelError ? (
                    <StatusBanner message={modelError} tone="warning" />
                  ) : !modelReady ? (
                    <StatusBanner message="Loading face model and secure crypto runtime..." tone="neutral" />
                  ) : null}

                  {captureError ? <StatusBanner message={captureError} tone="warning" /> : null}

                  {!isProcessing ? (
                    <StatusBanner message={quality.message} tone={quality.tone} />
                  ) : (
                    <View
                      style={[
                        styles.processingCard,
                        {
                          borderRadius: scaleSpacing(layout, 20, 1.08),
                          padding: scaleSpacing(layout, 16, 1.08),
                        },
                      ]}
                    >
                      <ActivityIndicator color={palette.textInverse} />
                      <Text style={[styles.processingTitle, { fontSize: scaleFont(layout, 16) }]}>
                        {phaseLabel(processingPhase)}
                      </Text>
                      <Text
                        style={[
                          styles.processingBody,
                          {
                            fontSize: scaleFont(layout, 14),
                            lineHeight: scaleFont(layout, 20),
                          },
                        ]}
                      >
                        Keep the phone steady while the pass is being assembled and signed.
                      </Text>
                    </View>
                  )}

                  <PrimaryButton
                    disabled={!quality.canCapture || isProcessing}
                    label={isProcessing ? 'Creating secure pass...' : 'Capture and issue pass'}
                    onPress={() => {
                      void handleCapture();
                    }}
                  />
                  <PrimaryButton label="Back" onPress={() => router.back()} tone="ghost" />
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.portraitShell, { gap: layout.sectionGap, maxWidth: layout.contentMaxWidth }]}>
              <View
                style={[
                  styles.topPanel,
                  {
                    borderRadius: scaleSpacing(layout, 24, 1.08),
                    padding: panelPadding,
                  },
                ]}
              >
                <Text style={[styles.topEyebrow, { fontSize: scaleFont(layout, 12) }]}>Capture</Text>
                <Text
                  style={[
                    styles.topTitle,
                    { fontSize: titleFontSize, lineHeight: titleLineHeight },
                  ]}
                >
                  Align your face with the guide.
                </Text>
                <Text
                  style={[
                    styles.topSubtitle,
                    {
                      fontSize: subtitleFontSize,
                      lineHeight: subtitleLineHeight,
                    },
                  ]}
                >
                  We only keep enough information in memory to issue the pass for {state.bundle.event_id}.
                </Text>
              </View>

              <View
                style={[
                  styles.cameraStage,
                  cameraStageStyle,
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
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.cameraTint} />
                <CameraGuide ready={quality.canCapture && !isProcessing} />
              </View>

              <View
                style={[
                  styles.bottomPanel,
                  {
                    borderRadius: scaleSpacing(layout, 24, 1.08),
                    gap: scaleSpacing(layout, 12, 1.05),
                    padding: panelPadding,
                  },
                ]}
              >
                {modelError ? (
                  <StatusBanner message={modelError} tone="warning" />
                ) : !modelReady ? (
                  <StatusBanner message="Loading face model and secure crypto runtime..." tone="neutral" />
                ) : null}

                {captureError ? <StatusBanner message={captureError} tone="warning" /> : null}

                {!isProcessing ? (
                  <StatusBanner message={quality.message} tone={quality.tone} />
                ) : (
                  <View
                    style={[
                      styles.processingCard,
                      {
                        borderRadius: scaleSpacing(layout, 20, 1.08),
                        padding: scaleSpacing(layout, 16, 1.08),
                      },
                    ]}
                  >
                    <ActivityIndicator color={palette.textInverse} />
                    <Text style={[styles.processingTitle, { fontSize: scaleFont(layout, 16) }]}>
                      {phaseLabel(processingPhase)}
                    </Text>
                    <Text
                      style={[
                        styles.processingBody,
                        {
                          fontSize: scaleFont(layout, 14),
                          lineHeight: scaleFont(layout, 20),
                        },
                      ]}
                    >
                      Keep the phone steady while the pass is being assembled and signed.
                    </Text>
                  </View>
                )}

                <PrimaryButton
                  disabled={!quality.canCapture || isProcessing}
                  label={isProcessing ? 'Creating secure pass...' : 'Capture and issue pass'}
                  onPress={() => {
                    void handleCapture();
                  }}
                />
                <PrimaryButton label="Back" onPress={() => router.back()} tone="ghost" />
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
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
  const layout = useResponsiveLayout();

  return (
    <View style={styles.fallbackRoot}>
      <View
        style={[
          styles.fallbackCard,
          {
            borderRadius: scaleSpacing(layout, 28, 1.08),
            gap: scaleSpacing(layout, 14, 1.05),
            maxWidth: layout.contentMaxWidth,
            padding: scaleSpacing(layout, 22, 1.08),
          },
        ]}
      >
        <Text
          style={[
            styles.fallbackTitle,
            {
              fontSize: scaleFont(layout, 28, 1.12),
              lineHeight: scaleFont(layout, 34, 1.12),
            },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.fallbackBody,
            {
              fontSize: scaleFont(layout, 15),
              lineHeight: scaleFont(layout, 22),
            },
          ]}
        >
          {body}
        </Text>
        <PrimaryButton label={ctaLabel} onPress={onPress} />
        {secondaryAction && secondaryLabel ? (
          <PrimaryButton label={secondaryLabel} onPress={secondaryAction} tone="ghost" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlay,
  },
  cameraColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  cameraStage: {
    alignSelf: 'center',
    backgroundColor: palette.surfaceInverse,
    borderColor: 'rgba(248,250,255,0.2)',
    borderWidth: 1,
    overflow: 'hidden',
  },
  captureScreen: {
    backgroundColor: palette.surfaceInverse,
    flex: 1,
  },
  captureLayout: {
    alignItems: 'center',
    flex: 1,
  },
  landscapeShell: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    width: '100%',
  },
  portraitShell: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  sideColumn: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 360,
  },
  bottomPanel: {
    backgroundColor: palette.card,
  },
  fallbackBody: {
    ...typography.body,
    color: palette.ink,
  },
  fallbackCard: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    width: '100%',
  },
  fallbackRoot: {
    alignItems: 'center',
    backgroundColor: palette.background,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  fallbackTitle: {
    ...typography.title,
    color: palette.ink,
  },
  processingBody: {
    ...typography.body,
    color: palette.textInverseSubtle,
  },
  processingCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceInverseSoft,
    gap: 8,
  },
  processingTitle: {
    ...typography.title,
    color: palette.textInverse,
  },
  topEyebrow: {
    ...typography.title,
    color: palette.accentSoft,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  topPanel: {
    backgroundColor: palette.surfaceInverseSoft,
    gap: 8,
  },
  topSubtitle: {
    ...typography.body,
    color: palette.textInverseMuted,
  },
  topTitle: {
    ...typography.title,
    color: palette.textInverse,
  },
});
