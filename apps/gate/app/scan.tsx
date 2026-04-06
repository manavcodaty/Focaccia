import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

function GateFallback({
  body,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
  title,
}: {
  body: string;
  onPrimaryPress(): void;
  onSecondaryPress?: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
  title: string;
}) {
  return (
    <ScreenShell>
      <SectionCard eyebrow="Scan" title={title}>
        <StatusBanner message={body} tone="warning" />
        <PrimaryButton label={primaryLabel} onPress={onPrimaryPress} />
        {secondaryLabel && onSecondaryPress ? (
          <PrimaryButton label={secondaryLabel} onPress={onSecondaryPress} tone="ghost" />
        ) : null}
      </SectionCard>
    </ScreenShell>
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const { gate, processToken } = useGate();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Ready to scan');
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
          setStatus('Token detected. Verifying signature and replay state...');
          setIsProcessing(true);

          void processToken(token, scanStartedAtRef.current)
            .then((decision) => {
              if (decision) {
                router.replace('/result');
                return;
              }

              router.replace('/liveness');
            })
            .catch((scanError) => {
              setError(scanError instanceof Error ? scanError.message : 'Offline verification failed.');
              setStatus('Scanner ready');
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
      <GateFallback
        body="This device is not provisioned yet. Scan the web dashboard QR first."
        onPrimaryPress={() => router.replace('/provision')}
        primaryLabel="Provision gate"
        title="Provisioning required"
      />
    );
  }

  if (!device) {
    return (
      <GateFallback
        body="A rear camera is required for QR scanning and live verification."
        onPrimaryPress={() => router.replace('/')}
        primaryLabel="Back to home"
        title="Rear camera unavailable"
      />
    );
  }

  if (!hasPermission) {
    return (
      <GateFallback
        body="Camera access is required to scan passes and complete offline verification."
        onPrimaryPress={() => {
          void requestPermission();
        }}
        onSecondaryPress={() => {
          void Linking.openSettings();
        }}
        primaryLabel="Allow camera"
        secondaryLabel="Open settings"
        title="Camera permission required"
      />
    );
  }

  return (
    <ScreenShell scroll={false} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Scan</Text>
        <Text style={styles.title}>{gate.event_name}</Text>
        <Text style={styles.subtitle}>
          Offline verification checks signature, event, replay, revocation cache, and gate-only
          decryptability before live matching starts.
        </Text>
      </View>

      <SectionCard eyebrow="Status" title="Scanner live">
        <View style={styles.statusRow}>
          <StatusChip label="Offline-ready" tone="success" />
          <StatusChip label={gate.policy.single_entry ? 'Single-entry enforced' : 'Policy mismatch'} tone="warning" />
        </View>
        <MetricRow label="Threshold" value={String(gate.policy.match_threshold)} />
        <MetricRow label="Liveness timeout" value={`${gate.policy.liveness_timeout_ms} ms`} />
        <StatusBanner
          message={error ?? status}
          tone={error ? 'danger' : isProcessing ? 'warning' : 'success'}
        />
      </SectionCard>

      <View style={styles.preview}>
        <Camera
          codeScanner={codeScanner}
          device={device}
          isActive={!isProcessing}
          style={styles.camera}
        />
        <View style={styles.dimTop} />
        <View style={styles.dimBottom} />
        <View style={styles.scanFrame} />
      </View>

      <View style={styles.footerActions}>
        <PrimaryButton label="Manual fallback" onPress={() => router.push('/fallback')} tone="ghost" />
        <PrimaryButton label="Settings" onPress={() => router.push('/settings')} tone="ghost" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  dimBottom: {
    backgroundColor: palette.overlay,
    bottom: 0,
    height: '24%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dimTop: {
    backgroundColor: palette.overlay,
    height: '24%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
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
  header: {
    gap: 8,
  },
  preview: {
    borderRadius: 30,
    flex: 1,
    minHeight: 360,
    overflow: 'hidden',
    position: 'relative',
  },
  scanFrame: {
    borderColor: palette.scanFrame,
    borderRadius: 30,
    borderWidth: 4,
    height: '46%',
    left: '10%',
    position: 'absolute',
    top: '27%',
    width: '80%',
  },
  screen: {
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subtitle: {
    ...typography.body,
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    ...typography.display,
    color: palette.ink,
    fontSize: 32,
    lineHeight: 36,
  },
});
