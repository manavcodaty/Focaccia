import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { DetailList } from '@/components/detail-list';
import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatTimestamp } from '@/lib/display';
import { gateReadiness, shortAge } from '@/lib/gate-presentation';
import { THEME } from '@/lib/theme';
import { useRevocationCache } from '@/lib/use-revocation-cache';
import { useGate } from '@/state/gate-context';

export default function SettingsScreen() {
  const router = useRouter();
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
  const readiness = gateReadiness(Boolean(gate), cache.state);
  const pending = stats?.pendingSyncCount ?? 0;
  const blocked = stats?.blockedSyncCount ?? 0;

  async function handleSync() {
    setError(null);
    setFeedback(null);
    setIsSyncing(true);

    try {
      const count = await syncRevocationCache();
      await refreshStats();
      setFeedback(`${count} revocations synced`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Revocation sync failed.');
    } finally {
      setIsSyncing(false);
    }
  }

  function handleRetry() {
    setError(null);
    setFeedback(null);
    void retryCheckinSync()
      .then(() => {
        setFeedback('Synced');
      })
      .catch((syncError) => {
        setError(syncError instanceof Error ? syncError.message : 'Gate sync failed.');
      });
  }

  return (
    <ScreenShell>
      <Text variant="h1">Settings</Text>

      {feedback ? <InlineAlert message={feedback} tone="default" /> : null}
      {error ? <InlineAlert message={error} /> : null}

      <Section title="Revocations">
        <DetailList
          items={[
            { label: 'Status', tone: readiness.tone, value: readiness.label },
            { label: 'Updated', value: shortAge(cache.ageMs) },
            { label: 'Cached', value: String(stats?.revocationCount ?? 0) },
          ]}
        />
        <Button disabled={!gate || isSyncing || syncInProgress} onPress={() => void handleSync()}>
          {isSyncing ? <ActivityIndicator color={THEME.light.primaryForeground} /> : null}
          <Text>Refresh</Text>
        </Button>
      </Section>

      <Section title="Check-ins">
        <DetailList
          items={[
            { label: 'Pending', tone: pending > 0 ? 'warning' : 'default', value: String(pending) },
            { label: 'Blocked', tone: blocked > 0 ? 'destructive' : 'default', value: String(blocked) },
            { label: 'Synced', value: String(stats?.syncedCheckinCount ?? 0) },
            { label: 'Last sync', value: formatTimestamp(stats?.lastSyncAt ?? null) },
          ]}
        />
        <Button disabled={!gate || syncInProgress} onPress={handleRetry} variant="outline">
          {syncInProgress ? <ActivityIndicator color={THEME.light.foreground} /> : null}
          <Text>Retry sync</Text>
        </Button>
      </Section>

      {gate ? (
        <Section title="Policy">
          <DetailList
            items={[
              { label: 'Match threshold', value: String(gate.policy.match_threshold) },
              { label: 'Manual entry', value: gate.policy.typed_token_fallback ? 'On' : 'Off' },
            ]}
          />
        </Section>
      ) : null}

      <Section title="Organizer">
        {auth ? (
          <>
            <DetailList items={[{ label: 'Signed in', value: auth.email }]} />
            <Button onPress={signOut} variant="destructive">
              <Text>Sign out</Text>
            </Button>
          </>
        ) : (
          <Button onPress={() => router.push('/provision')} variant="outline">
            <Text>Sign in</Text>
          </Button>
        )}
      </Section>
    </ScreenShell>
  );
}
