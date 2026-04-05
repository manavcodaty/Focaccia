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
import { useEnrollment } from '../src/state/enrollment-context';
import { palette } from '../src/theme';
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
          issuePass: requestPassSignature,
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

  return (
    <View style={styles.captureScreen}>
      <Camera
        device={device}
        isActive={!isProcessing}
        photo
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cameraTint} />
      <CameraGuide ready={quality.canCapture && !isProcessing} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View style={styles.topPanel}>
          <Text style={styles.topEyebrow}>Capture</Text>
          <Text style={styles.topTitle}>Align your face with the guide.</Text>
          <Text style={styles.topSubtitle}>
            We only keep enough information in memory to issue the pass for {state.bundle.event_id}.
          </Text>
        </View>

        <View style={styles.bottomPanel}>
          {modelError ? (
            <StatusBanner message={modelError} tone="warning" />
          ) : !modelReady ? (
            <StatusBanner message="Loading face model and secure crypto runtime..." tone="neutral" />
          ) : null}

          {captureError ? <StatusBanner message={captureError} tone="warning" /> : null}

          {!isProcessing ? (
            <StatusBanner message={quality.message} tone={quality.tone} />
          ) : (
            <View style={styles.processingCard}>
              <ActivityIndicator color={palette.textInverse} />
              <Text style={styles.processingTitle}>{phaseLabel(processingPhase)}</Text>
              <Text style={styles.processingBody}>
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
  return (
    <View style={styles.fallbackRoot}>
      <View style={styles.fallbackCard}>
        <Text style={styles.fallbackTitle}>{title}</Text>
        <Text style={styles.fallbackBody}>{body}</Text>
        <PrimaryButton label={ctaLabel} onPress={onPress} />
        {secondaryAction && secondaryLabel ? (
          <PrimaryButton label={secondaryLabel} onPress={secondaryAction} tone="ghost" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomPanel: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  cameraTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlay,
  },
  captureScreen: {
    backgroundColor: palette.surfaceInverse,
    flex: 1,
  },
  fallbackBody: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  fallbackCard: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 22,
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
    color: palette.ink,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  processingBody: {
    color: palette.textInverseSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
  processingCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceInverseSoft,
    borderRadius: 20,
    gap: 8,
    padding: 16,
  },
  processingTitle: {
    color: palette.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  topEyebrow: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  topPanel: {
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  topSubtitle: {
    color: palette.textInverseMuted,
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 320,
  },
  topTitle: {
    color: palette.textInverse,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    maxWidth: 320,
  },
});
