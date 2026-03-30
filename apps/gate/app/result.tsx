import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { decisionTone, formatDuration } from '../src/lib/display';
import { useGate } from '../src/state/gate-context';
import { palette } from '../src/theme';

export default function ResultScreen() {
  const router = useRouter();
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

  return (
    <ScreenShell>
      <SectionCard
        eyebrow="Decision"
        title={lastResult.accepted ? 'Entry accepted' : 'Entry rejected'}
      >
        <StatusChip
          label={lastResult.reasonCode}
          tone={decisionTone(lastResult)}
        />
        <StatusBanner message={lastResult.hint} tone={decisionTone(lastResult)} />
        <Text style={styles.headline}>
          {lastResult.accepted
            ? 'The pass was verified entirely offline and the replay marker is now stored locally.'
            : 'The gate rejected the pass before entry was granted.'}
        </Text>
      </SectionCard>

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
          label="Back to scanner"
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
        <PrimaryButton label="Home" onPress={() => router.replace('/')} tone="ghost" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  headline: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 24,
  },
});
