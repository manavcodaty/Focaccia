import { useRouter } from 'expo-router';
import { FileDownIcon, KeyboardIcon, SettingsIcon } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { DetailList } from '@/components/detail-list';
import { InlineAlert } from '@/components/inline-alert';
import { NavList } from '@/components/nav-list';
import { ScreenShell } from '@/components/screen-shell';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { gateReadiness, shortAge, syncStatus } from '@/lib/gate-presentation';
import { THEME } from '@/lib/theme';
import { useRevocationCache } from '@/lib/use-revocation-cache';
import { cn } from '@/lib/utils';
import { useGate } from '@/state/gate-context';

const toneClass = {
  default: '',
  destructive: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
} as const;

export default function GateHomeScreen() {
  const router = useRouter();
  const { dbError, dbReady, gate, stats } = useGate();
  const cache = useRevocationCache(gate?.last_revocation_sync_at ?? null);
  const scannerReady = cache.state === 'fresh';
  const readiness = gateReadiness(Boolean(gate), cache.state);
  const pendingSyncCount = stats?.pendingSyncCount ?? 0;
  const sync = syncStatus(pendingSyncCount);
  const blocked = stats?.blockedSyncCount ?? 0;

  return (
    <ScreenShell header={false}>
      <View className="gap-6">
        <BrandLogo />
        <View className="gap-2">
          <Text variant="h1">{gate?.event_name ?? 'Gate'}</Text>
          <View className="flex-row items-center gap-2">
            {!dbReady ? (
              <ActivityIndicator accessibilityLabel="Opening gate storage" color={THEME.light.mutedForeground} size="small" />
            ) : (
              <Text className={cn('text-sm', toneClass[readiness.tone])}>{readiness.label}</Text>
            )}
            {dbReady && gate && pendingSyncCount > 0 ? (
              <Text className={cn('text-sm', toneClass[sync.tone])}>· {sync.label}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {dbError ? <InlineAlert message={dbError} /> : null}

      <View className="gap-3">
        <Button
          disabled={!dbReady || (Boolean(gate) && !scannerReady)}
          onPress={() => router.push(gate ? '/scan' : '/provision')}
          size="lg"
        >
          <Text>{gate ? 'Open scanner' : 'Set up gate'}</Text>
        </Button>
        {gate && !scannerReady ? (
          <Button onPress={() => router.push('/settings')} variant="outline">
            <Text>Refresh revocations</Text>
          </Button>
        ) : null}
      </View>

      {gate ? (
        <>
          <Section title="Status">
            <DetailList
              items={[
                { label: 'Revocations', tone: scannerReady ? 'default' : readiness.tone, value: shortAge(cache.ageMs) },
                { label: 'Accepted', value: String(stats?.usedPassCount ?? 0) },
                { label: 'Queued', tone: pendingSyncCount > 0 ? 'warning' : 'default', value: String(pendingSyncCount) },
                { label: 'Needs retry', tone: blocked > 0 ? 'destructive' : 'default', value: String(blocked) },
              ]}
            />
          </Section>

          <NavList
            items={[
              { icon: KeyboardIcon, label: 'Manual entry', onPress: () => router.push('/fallback') },
              { icon: SettingsIcon, label: 'Settings', onPress: () => router.push('/settings') },
              { icon: FileDownIcon, label: 'Export logs', onPress: () => router.push('/export') },
            ]}
          />
        </>
      ) : null}
    </ScreenShell>
  );
}
