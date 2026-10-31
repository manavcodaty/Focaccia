import { prepareCrypto } from '@face-pass/shared';
import { useRouter } from 'expo-router';
import { CameraIcon, CameraOffIcon, ScanFaceIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import { EmptyState } from '@/components/empty-state';
import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Section } from '@/components/section';
import { ThresholdControl } from '@/components/threshold-control';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { extractFaceEmbeddingFromPhoto, loadFaceEmbeddingModel } from '@/lib/embedding-model';
import { MAX_MATCH_THRESHOLD } from '@/lib/offline-verifier';
import { THEME } from '@/lib/theme';
import { useResponsiveLayout } from '@/lib/use-responsive-layout';
import { useGate } from '@/state/gate-context';

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
    defaultMatchThreshold,
    matchThreshold,
    pendingVerification,
    setMatchThresholdOverride,
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
          setModelError(error instanceof Error ? error.message : 'Face model unavailable.');
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
      setProcessingError(error instanceof Error ? error.message : 'No clear face. Try again.');
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
      <ScreenShell header={false}>
        <EmptyState icon={ScanFaceIcon} title="No pass scanned">
          <Button onPress={() => router.replace('/scan')}><Text>Scan</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  if (!device) {
    return (
      <ScreenShell header={false}>
        <EmptyState icon={CameraOffIcon} title="Rear camera unavailable">
          <Button onPress={cancelVerification} variant="outline"><Text>Cancel</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  if (!hasPermission) {
    return (
      <ScreenShell header={false}>
        <EmptyState icon={CameraIcon} title="Camera access">
          <Button onPress={() => void requestPermission()}><Text>Allow camera</Text></Button>
          <Button onPress={() => void Linking.openSettings()} variant="outline"><Text>Open Settings</Text></Button>
          <Button onPress={cancelVerification} variant="ghost"><Text>Cancel</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  const preview = (
    <View
      className="bg-foreground w-full self-center overflow-hidden rounded-lg"
      style={{ aspectRatio: layout.cameraAspectRatio, maxWidth: layout.cameraFrameMaxWidth }}
    >
      <Camera ref={camera} device={device} isActive={true} photo style={StyleSheet.absoluteFill} />
      <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
        <View className="aspect-[3/4] w-[62%] rounded-full border-2 border-white/80" />
      </View>
      {isProcessing ? (
        <View className="absolute inset-x-4 top-4 flex-row items-center justify-center gap-2 rounded-lg bg-foreground/70 px-4 py-3">
          <ActivityIndicator color={THEME.light.primaryForeground} size="small" />
          <Text className="text-primary-foreground shrink text-sm font-medium">Matching</Text>
        </View>
      ) : null}
    </View>
  );

  const threshold = matchThreshold !== null && defaultMatchThreshold !== null ? (
    <Section title="Match threshold">
      <ThresholdControl
        calibratedMax={MAX_MATCH_THRESHOLD}
        defaultValue={defaultMatchThreshold}
        disabled={isProcessing}
        onChange={setMatchThresholdOverride}
        value={matchThreshold}
      />
    </Section>
  ) : null;

  const controls = (
    <View className="gap-3">
      {modelError ? <InlineAlert message={modelError} /> : null}
      {processingError ? <InlineAlert message={processingError} /> : null}
      <Button
        disabled={!modelReady || isProcessing}
        onPress={() => {
          void handleVerificationCapture();
        }}
        size="lg"
      >
        {!modelReady && !modelError ? <ActivityIndicator color={THEME.light.primaryForeground} /> : null}
        <Text>Capture</Text>
      </Button>
      <Button onPress={cancelVerification} variant="outline">
        <Text>Cancel</Text>
      </Button>
    </View>
  );

  return (
    <ScreenShell header={false} variant="scanner">
      {layout.isLandscape ? (
        <View className="flex-1 flex-row items-center gap-6">
          <View className="flex-1">{preview}</View>
          <View className="w-[320px] gap-6">
            <Text variant="h1">Face match</Text>
            {threshold}
            {controls}
          </View>
        </View>
      ) : (
        <>
          <Text variant="h1">Face match</Text>
          {preview}
          {threshold}
          {controls}
        </>
      )}
    </ScreenShell>
  );
}
