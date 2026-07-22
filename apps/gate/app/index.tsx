import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '../src/components/brand-logo';
import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { formatTimestamp, snippet } from '../src/lib/display';
import { formatCacheAge } from '../src/lib/gate-sync';
import { scaleFont } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useRevocationCache } from '../src/lib/use-revocation-cache';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

export default function GateHomeScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { auth, dbError, dbReady, gate, signOut, stats } = useGate();
  const cache = useRevocationCache(gate?.last_revocation_sync_at ?? null);
  const scannerReady = cache.state === 'fresh';
  const pendingSyncCount = stats?.pendingSyncCount ?? 0;
  const readinessLabel = !gate
    ? 'Needs setup'
    : scannerReady
      ? 'Offline ready'
      : 'Refresh required';

  return (
    <ScreenShell>
      <View style={styles.hero}>
        <BrandLogo />
        <Text style={[styles.eyebrow, { fontSize: scaleFont(layout, 12) }]}>Gate operations</Text>
        <Text style={[styles.title, { fontSize: scaleFont(layout, 34, 1.12), lineHeight: scaleFont(layout, 39, 1.12) }]}>
          {gate?.event_name ?? 'Prepare this gate'}
        </Text>
        <Text style={[styles.subtitle, { fontSize: scaleFont(layout, 16), lineHeight: scaleFont(layout, 24) }]}>
          Confirm readiness, admit attendees offline, and synchronize signed check-ins when connectivity returns.
        </Text>
      </View>

      {!dbReady ? <StatusBanner message="Opening encrypted local gate storage…" title="Preparing device" /> : null}
      {dbError ? <StatusBanner message={dbError} title="Local storage unavailable" tone="danger" /> : null}

      <SectionCard eyebrow="Door readiness" title={readinessLabel} tone={scannerReady ? 'default' : 'warning'}>
        <View style={styles.statusRow}>
          <StatusChip label={readinessLabel} tone={scannerReady ? 'success' : 'warning'} />
          <StatusChip label={pendingSyncCount > 0 ? 'Sync pending' : 'Sync clear'} tone={pendingSyncCount > 0 ? 'warning' : 'success'} />
        </View>
        <MetricRow label="Event" value={gate?.event_name ?? 'No event assigned'} />
        <MetricRow label="Revocation cache" value={gate ? formatCacheAge(cache.ageMs) : 'Not available'} />
        <MetricRow label="Queued check-ins" value={String(pendingSyncCount)} />
        {gate && !scannerReady ? (
          <StatusBanner
            message={cache.state === 'critical'
              ? 'The revocation cache is missing or too old. Refresh it before opening the scanner.'
              : 'The revocation cache is stale. Refresh it before admitting attendees.'}
            title="Refresh required"
            tone="warning"
          />
        ) : null}
        {!gate ? (
          <StatusBanner
            message="Sign in as an organizer and scan the event provisioning QR before this device can verify passes."
            title="Needs setup"
            tone="warning"
          />
        ) : null}
        <PrimaryButton
          disabled={Boolean(gate) && !scannerReady}
          label={gate ? 'Open scanner' : 'Set up gate'}
          onPress={() => router.push(gate ? '/scan' : '/provision')}
        />
        {gate && !scannerReady ? (
          <PrimaryButton label="Refresh revocations" onPress={() => router.push('/settings')} tone="ghost" />
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="Local operations" title="Entry records" tone="subtle">
        <MetricRow label="Accepted passes" value={String(stats?.usedPassCount ?? 0)} />
        <MetricRow label="Check-ins synchronized" value={String(stats?.syncedCheckinCount ?? 0)} />
        <MetricRow label="Check-ins needing retry" value={String(stats?.blockedSyncCount ?? 0)} />
        <MetricRow label="Revocations cached" value={String(stats?.revocationCount ?? 0)} />
        <MetricRow label="Last local record" value={formatTimestamp(stats?.lastRecordedAt ?? null)} />
      </SectionCard>

      <SectionCard eyebrow="Device detail" title={auth ? auth.email : 'Organizer sign-in required'}>
        <StatusChip label={auth ? 'Organizer authenticated' : 'Signed out'} tone={auth ? 'success' : 'warning'} />
        <MetricRow label="Event ID" value={gate?.event_id ?? 'No event yet'} />
        <MetricRow label="Signer key" value={gate ? snippet(gate.pk_sign_event) : 'Added during setup'} />
        <MetricRow label="Event salt" value={gate ? snippet(gate.event_salt) : 'Added during setup'} />
        <MetricRow label="Provisioned" value={gate ? formatTimestamp(gate.provisioned_at) : 'Not provisioned'} />
        {auth ? <PrimaryButton label="Sign out organizer" onPress={signOut} tone="ghost" /> : null}
      </SectionCard>

      <View style={styles.secondaryActions}>
        <PrimaryButton disabled={!gate} label="Manual fallback" onPress={() => router.push('/fallback')} tone="ghost" />
        <PrimaryButton disabled={!gate} label="Settings" onPress={() => router.push('/settings')} tone="ghost" />
        <PrimaryButton disabled={!gate} label="Export logs" onPress={() => router.push('/export')} tone="ghost" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...typography.bodyStrong, color: palette.clay, letterSpacing: 1.4, textTransform: 'uppercase' },
  hero: { gap: 8, paddingTop: 4 },
  secondaryActions: { gap: 10 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subtitle: { ...typography.body, color: palette.mutedStone },
  title: { ...typography.display, color: palette.ink },
});
