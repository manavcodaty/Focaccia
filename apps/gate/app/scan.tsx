import { useRouter } from 'expo-router';
import { CameraIcon, CameraOffIcon, ScanLineIcon } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

import { EmptyState } from '@/components/empty-state';
import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { THEME } from '@/lib/theme';
import { useResponsiveLayout } from '@/lib/use-responsive-layout';

import { useGate } from '@/state/gate-context';

export default function ScanScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { gate, processToken } = useGate();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lockRef = useRef(false);
  const scanStartedAtRef = useRef(Date.now());
  const codeScanner = useCodeScanner(
    useMemo(
      () => ({
        codeTypes: ['qr'],
        onCodeScanned: (codes: Array<{ value?: string }>) => {
          if (lockRef.current || isProcessing) {
            return;
          }

          const token = codes.find((code) => code.value)?.value;

          if (!token) {
            return;
          }

          lockRef.current = true;
          setError(null);
          setIsProcessing(true);

          void processToken(token, scanStartedAtRef.current)
            .then((decision) => {
              if (decision) {
                router.replace('/result');
                return;
              }

              router.replace('/face-match');
            })
            .catch((scanError) => {
              setError(scanError instanceof Error ? scanError.message : 'Verification failed.');
              lockRef.current = false;
              scanStartedAtRef.current = Date.now();
            })
            .finally(() => {
              setIsProcessing(false);
            });
        },
      }),
      [isProcessing, processToken, router],
    ),
  );

  if (!gate) {
    return (
      <ScreenShell>
        <EmptyState icon={ScanLineIcon} title="Needs setup">
          <Button onPress={() => router.replace('/provision')}><Text>Set up gate</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  if (!device) {
    return (
      <ScreenShell>
        <EmptyState icon={CameraOffIcon} title="Rear camera unavailable" />
      </ScreenShell>
    );
  }

  if (!hasPermission) {
    return (
      <ScreenShell>
        <EmptyState icon={CameraIcon} title="Camera access">
          <Button onPress={() => void requestPermission()}><Text>Allow camera</Text></Button>
          <Button onPress={() => void Linking.openSettings()} variant="outline"><Text>Open Settings</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  const preview = (
    <View
      className="bg-foreground w-full self-center overflow-hidden rounded-lg"
      style={{ aspectRatio: layout.previewAspectRatio, maxWidth: layout.previewFrameMaxWidth }}
    >
      <Camera codeScanner={codeScanner} device={device} isActive={!isProcessing} style={StyleSheet.absoluteFill} />
      <View className="absolute inset-[12%] rounded-lg border-2 border-white/80" pointerEvents="none" />
    </View>
  );

  const controls = (
    <View className="gap-4">
      <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">
        {isProcessing ? <ActivityIndicator color={THEME.light.mutedForeground} size="small" /> : null}
        <Text className="text-muted-foreground shrink text-sm">{isProcessing ? 'Verifying' : 'Ready'}</Text>
      </View>
      {error ? <InlineAlert message={error} /> : null}
      <Button onPress={() => router.push('/fallback')} variant="outline">
        <Text>Manual entry</Text>
      </Button>
    </View>
  );

  return (
    <ScreenShell variant="scanner">
      {layout.isLandscape ? (
        <View className="flex-1 flex-row items-center gap-6">
          <View className="flex-1">{preview}</View>
          <View className="w-[300px] gap-6">
            <Text variant="h1">Scan</Text>
            {controls}
          </View>
        </View>
      ) : (
        <>
          <Text variant="h1">Scan</Text>
          <View className="gap-4">
            {preview}
            {controls}
          </View>
        </>
      )}
    </ScreenShell>
  );
}
