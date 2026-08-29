import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { decisionTone, formatDuration } from '../src/lib/display';
import { scaleFont } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

const isCloudE2E = process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1';

export default function ResultScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { gate, lastResult, resetLastResult } = useGate();

  if (!lastResult || !gate) {
    return (
      <ScreenShell>
        <SectionCard eyebrow="Result" title="No verification result">
          <StatusBanner
            message="Scan a pass first so the gate can render the final decision."
            tone="warning"
          />
          <PrimaryButton label="Back to scanner" onPress={() => router.replace('/scan')} />
        </SectionCard>
      </ScreenShell>
    );
  }

  const homeButton = <PrimaryButton label="Home" onPress={() => router.replace('/')} tone="ghost" />;

  return (
    <ScreenShell variant={lastResult.accepted ? 'accepted' : 'rejected'}>
      <View
        accessibilityLabel={`${lastResult.accepted ? 'Entry accepted' : 'Entry rejected'}. ${lastResult.hint}`}
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
        style={[styles.decision, lastResult.accepted ? styles.accepted : styles.rejected]}
      >
        <Text style={styles.decisionEyebrow}>Gate decision</Text>
        <Text style={[styles.decisionTitle, { fontSize: scaleFont(layout, 46, 1.12), lineHeight: scaleFont(layout, 50, 1.12) }]}>
          {lastResult.accepted ? 'Entry accepted' : 'Entry rejected'}
        </Text>
        <StatusChip
          label={lastResult.reasonCode}
          tone={decisionTone(lastResult)}
        />
        <StatusBanner message={lastResult.hint} title="Operator note" tone={decisionTone(lastResult)} />
        <Text
          style={[
            styles.headline,
            {
              fontSize: scaleFont(layout, 16),
              lineHeight: scaleFont(layout, 24),
            },
          ]}
        >
          {lastResult.accepted
            ? 'The pass was verified offline. Its replay marker and signed check-in are stored locally for automatic synchronization.'
            : 'The gate rejected the pass before entry was granted.'}
        </Text>
      </View>

      {isCloudE2E ? homeButton : null}

      <SectionCard eyebrow="Metrics" title="Verification timings">
        <MetricRow label="Scan" value={formatDuration(lastResult.timings.scan_ms)} />
        <MetricRow label="Decode" value={formatDuration(lastResult.timings.decode_ms)} />
        <MetricRow label="Verify" value={formatDuration(lastResult.timings.verify_ms)} />
        <MetricRow label="Decrypt" value={formatDuration(lastResult.timings.decrypt_ms)} />
        <MetricRow label="Liveness" value={formatDuration(lastResult.timings.liveness_ms)} />
        <MetricRow label="Match" value={formatDuration(lastResult.timings.match_ms)} />
        <MetricRow label="Total" value={formatDuration(lastResult.timings.total_ms)} />
        <MetricRow
          label="Distance"
          value={lastResult.hammingDistance === null ? 'Not reached' : String(lastResult.hammingDistance)}
        />
      </SectionCard>

      <SectionCard eyebrow="Context" title="Pass summary">
        <MetricRow label="Event ID" value={gate.event_id} />
        <MetricRow label="Pass ref" value={lastResult.pass_ref ?? 'Unavailable'} />
        <MetricRow label="Outcome" value={lastResult.outcome} />
        <MetricRow label="Reason" value={lastResult.reasonCode} />
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          label="Scan next pass"
          onPress={() => {
            resetLastResult();
            router.replace('/scan');
          }}
        />
        <PrimaryButton
          label="Manual fallback"
          onPress={() => router.replace('/fallback')}
          tone="ghost"
        />
        {!isCloudE2E ? homeButton : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  accepted: { borderColor: palette.acceptBorder },
  actions: {
    gap: 12,
  },
  decision: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 2,
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 30,
  },
  decisionEyebrow: { ...typography.bodyStrong, color: palette.clay, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  decisionTitle: { ...typography.display, color: palette.ink, letterSpacing: -0.7 },
  headline: {
    ...typography.body,
    color: palette.ink,
  },
  rejected: { borderColor: palette.alertBorder },
});
