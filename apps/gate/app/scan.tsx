import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
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
  useCodeScanner,
} from 'react-native-vision-camera';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { scaleFont, scaleSpacing } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
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
  const layout = useResponsiveLayout();
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

  const previewStyle = layout.isLandscape
    ? {
        width: Math.min(
          layout.previewFrameMaxWidth,
          layout.shortSide * (layout.isTablet ? 0.82 : 0.9),
        ),
      }
    : {
        maxWidth: layout.previewFrameMaxWidth,
        width: '100%' as const,
      };
  const scanFrameStyle: ViewStyle = {
    borderRadius: scaleSpacing(layout, 30, 1.08),
    height: layout.isLandscape ? '52%' : '46%',
    left: layout.isLandscape ? '14%' : '10%',
    top: layout.isLandscape ? '24%' : '27%',
    width: layout.isLandscape ? '72%' : '80%',
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
                  aspectRatio: layout.previewAspectRatio,
                  borderRadius: scaleSpacing(layout, 30, 1.08),
                },
              ]}
            >
              <Camera
                codeScanner={codeScanner}
                device={device}
                isActive={!isProcessing}
                style={styles.camera}
              />
              <View style={styles.dimTop} />
              <View style={styles.dimBottom} />
              <View style={[styles.scanFrame, scanFrameStyle]} />
            </View>
          </View>

          <View style={[styles.infoColumn, { gap: scaleSpacing(layout, 16, 1.08) }]}>
            <View style={styles.header}>
              <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 12) }]}>Scan</Text>
              <Text
                style={[
                  styles.title,
                  {
                    fontSize: scaleFont(layout, 32, 1.12),
                    lineHeight: scaleFont(layout, 36, 1.12),
                  },
                ]}
              >
                {gate.event_name}
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
                Offline verification checks signature, event, replay, revocation cache, and gate-only
                decryptability before live matching starts.
              </Text>
            </View>

            <SectionCard eyebrow="Status" title="Scanner live">
              <View style={styles.statusRow}>
                <StatusChip label="Offline-ready" tone="success" />
                <StatusChip
                  label={gate.policy.single_entry ? 'Single-entry enforced' : 'Policy mismatch'}
                  tone="warning"
                />
              </View>
              <MetricRow label="Threshold" value={String(gate.policy.match_threshold)} />
              <MetricRow label="Liveness timeout" value={`${gate.policy.liveness_timeout_ms} ms`} />
              <StatusBanner
                message={error ?? status}
                tone={error ? 'danger' : isProcessing ? 'warning' : 'success'}
              />
            </SectionCard>

            <View style={styles.footerActions}>
              <PrimaryButton label="Manual fallback" onPress={() => router.push('/fallback')} tone="ghost" />
              <PrimaryButton label="Settings" onPress={() => router.push('/settings')} tone="ghost" />
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 12) }]}>Scan</Text>
            <Text
              style={[
                styles.title,
                {
                  fontSize: scaleFont(layout, 32, 1.12),
                  lineHeight: scaleFont(layout, 36, 1.12),
                },
              ]}
            >
              {gate.event_name}
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
              Offline verification checks signature, event, replay, revocation cache, and gate-only
              decryptability before live matching starts.
            </Text>
          </View>

          <SectionCard eyebrow="Status" title="Scanner live">
            <View style={styles.statusRow}>
              <StatusChip label="Offline-ready" tone="success" />
              <StatusChip
                label={gate.policy.single_entry ? 'Single-entry enforced' : 'Policy mismatch'}
                tone="warning"
              />
            </View>
            <MetricRow label="Threshold" value={String(gate.policy.match_threshold)} />
            <MetricRow label="Liveness timeout" value={`${gate.policy.liveness_timeout_ms} ms`} />
            <StatusBanner
              message={error ?? status}
              tone={error ? 'danger' : isProcessing ? 'warning' : 'success'}
            />
          </SectionCard>

          <View
            style={[
              styles.preview,
              previewStyle,
              {
                aspectRatio: layout.previewAspectRatio,
                borderRadius: scaleSpacing(layout, 30, 1.08),
              },
            ]}
          >
            <Camera
              codeScanner={codeScanner}
              device={device}
              isActive={!isProcessing}
              style={styles.camera}
            />
            <View style={styles.dimTop} />
            <View style={styles.dimBottom} />
            <View style={[styles.scanFrame, scanFrameStyle]} />
          </View>

          <View style={styles.footerActions}>
            <PrimaryButton label="Manual fallback" onPress={() => router.push('/fallback')} tone="ghost" />
            <PrimaryButton label="Settings" onPress={() => router.push('/settings')} tone="ghost" />
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
  preview: {
    alignSelf: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  previewColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  scanFrame: {
    borderColor: palette.scanFrame,
    borderWidth: 4,
    position: 'absolute',
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
