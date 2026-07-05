import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MetricRow } from '../src/components/metric-row';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { StatusChip } from '../src/components/status-chip';
import { formatTimestamp } from '../src/lib/display';
import { formatCacheAge } from '../src/lib/gate-sync';
import { effectiveLivenessTimeoutMs } from '../src/lib/liveness';
import { scaleFont } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useRevocationCache } from '../src/lib/use-revocation-cache';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const {
    auth,
    gate,
    refreshStats,
    retryCheckinSync,
    signOut,
    stats,
    syncInProgress,
    syncRevocationCache,
  } = useGate();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRevocationCache(gate?.last_revocation_sync_at ?? null);
  const livenessTimeoutMs = gate ? effectiveLivenessTimeoutMs(gate.policy.liveness_timeout_ms) : null;

  async function handleSync() {
    setError(null);
    setFeedback(null);
    setIsSyncing(true);

    try {
      const count = await syncRevocationCache();
      await refreshStats();
      setFeedback(`Synced ${count} revoked pass IDs into the local offline cache.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Revocation sync failed.');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <ScreenShell>
      <SectionCard eyebrow="Settings" title="Gate policy and sync state">
        <StatusChip
          label={gate ? 'Provisioned' : 'Provisioning required'}
          tone={gate ? 'success' : 'warning'}
        />
        {feedback ? <StatusBanner message={feedback} tone="success" /> : null}
        {error ? <StatusBanner message={error} tone="danger" /> : null}
        <StatusBanner
          message="Revocations created while this gate is disconnected cannot affect entry decisions until a later successful refresh."
          tone={cache.state === 'fresh' ? 'neutral' : 'warning'}
        />
        <MetricRow label="Organizer" value={auth?.email ?? 'Signed out'} />
        <MetricRow
          label="Revocation sync"
          value={gate ? formatTimestamp(gate.last_revocation_sync_at) : 'No gate bundle'}
        />
        <MetricRow label="Cache age" value={formatCacheAge(cache.ageMs)} />
        <MetricRow label="Door-opening status" value={cache.state === 'fresh' ? 'Ready' : 'Refresh required'} />
        <MetricRow
          label="Match threshold"
          value={gate ? String(gate.policy.match_threshold) : 'Unavailable'}
        />
        <MetricRow
          label="Liveness timeout"
          value={livenessTimeoutMs ? `${Math.round(livenessTimeoutMs / 1000)} seconds` : 'Unavailable'}
        />
        <MetricRow
          label="Typed fallback"
          value={gate?.policy.typed_token_fallback ? 'Enabled' : 'Disabled'}
        />
      </SectionCard>

      <SectionCard eyebrow="Local store" title="SQLite counters">
        <MetricRow label="Used passes" value={String(stats?.usedPassCount ?? 0)} />
        <MetricRow label="Revocations" value={String(stats?.revocationCount ?? 0)} />
        <MetricRow label="Log rows" value={String(stats?.logCount ?? 0)} />
        <MetricRow label="Pending check-ins" value={String(stats?.pendingSyncCount ?? 0)} />
        <MetricRow label="Blocked check-ins" value={String(stats?.blockedSyncCount ?? 0)} />
        <MetricRow label="Synchronized check-ins" value={String(stats?.syncedCheckinCount ?? 0)} />
        <MetricRow label="Last check-in sync" value={formatTimestamp(stats?.lastSyncAt ?? null)} />
        <MetricRow
          label="Last log"
          value={formatTimestamp(stats?.lastRecordedAt ?? null)}
        />
      </SectionCard>

      <SectionCard eyebrow="Notes" title="Offline operation">
        <Text style={[styles.note, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          The scan pipeline never calls the network. Signed check-ins upload after acceptance, and
          the gate refreshes revocations on foreground, network restoration, and once per minute
          while active.
        </Text>
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          disabled={!gate || isSyncing || syncInProgress}
          label={isSyncing ? 'Syncing revocations...' : 'Refresh revocation cache'}
          onPress={() => {
            void handleSync();
          }}
        />
        <PrimaryButton
          disabled={!gate || syncInProgress}
          label={syncInProgress ? 'Synchronizing...' : 'Retry check-in synchronization'}
          onPress={() => {
            setError(null);
            setFeedback(null);
            void retryCheckinSync()
              .then(() => {
                setFeedback('Check-in queue and revocation cache synchronized.');
              })
              .catch((syncError) => {
                setError(syncError instanceof Error ? syncError.message : 'Gate sync failed.');
              });
          }}
          tone="ghost"
        />
        {auth ? (
          <PrimaryButton label="Sign out organizer" onPress={signOut} tone="ghost" />
        ) : (
          <PrimaryButton label="Go to provisioning" onPress={() => router.push('/provision')} tone="ghost" />
        )}
        <PrimaryButton label="Back" onPress={() => router.back()} tone="ghost" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  note: {
    ...typography.body,
    color: palette.ink,
  },
});
