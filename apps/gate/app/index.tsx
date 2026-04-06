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
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

export default function GateHomeScreen() {
  const router = useRouter();
  const { auth, dbError, dbReady, gate, signOut, stats } = useGate();

  return (
    <ScreenShell>
      <View style={styles.hero}>
        <BrandLogo />
        <Text style={styles.eyebrow}>Gate</Text>
        <Text style={styles.title}>Offline entry control.</Text>
        <Text style={styles.subtitle}>
          Provision one gate per event, verify passes without a network dependency, and keep
          replay state on-device.
        </Text>
      </View>

      {!dbReady ? <StatusBanner message="Opening local gate storage..." tone="neutral" /> : null}
      {dbError ? <StatusBanner message={dbError} tone="danger" /> : null}

      <SectionCard eyebrow="Status" title={gate ? gate.event_name : 'Gate not provisioned'}>
        <StatusChip
          label={gate ? 'Offline bundle ready' : 'Provisioning required'}
          tone={gate ? 'success' : 'warning'}
        />
        <MetricRow label="Event ID" value={gate ? gate.event_id : 'No event yet'} />
        <MetricRow
          label="Signer key"
          value={gate ? snippet(gate.pk_sign_event) : 'Scan the web provisioning QR first'}
        />
        <MetricRow
          label="Event salt"
          value={gate ? snippet(gate.event_salt) : 'Provisioning QR carries this salt'}
        />
        <MetricRow
          label="Provisioned at"
          value={gate ? formatTimestamp(gate.provisioned_at) : 'Not provisioned'}
        />
      </SectionCard>

      <SectionCard eyebrow="Operator" title={auth ? auth.email : 'Organizer sign-in required'}>
        <StatusChip
          label={auth ? 'Organizer authenticated' : 'Signed out'}
          tone={auth ? 'success' : 'warning'}
        />
        <MetricRow label="Auth state" value={auth ? 'Ready for provisioning and sync' : 'Local-only'} />
        <MetricRow
          label="Revocation sync"
          value={gate ? formatTimestamp(gate.last_revocation_sync_at) : 'No gate bundle yet'}
        />
        {auth ? (
          <PrimaryButton
            label="Sign out organizer"
            onPress={signOut}
            tone="ghost"
          />
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="Operations" title="Local state">
        <MetricRow label="Accepted passes" value={String(stats?.usedPassCount ?? 0)} />
        <MetricRow label="Revocations cached" value={String(stats?.revocationCount ?? 0)} />
        <MetricRow label="Log rows" value={String(stats?.logCount ?? 0)} />
        <MetricRow
          label="Last log"
          value={formatTimestamp(stats?.lastRecordedAt ?? null)}
        />
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          label={gate ? 'Open scanner' : 'Provision this gate'}
          onPress={() => router.push(gate ? '/scan' : '/provision')}
        />
        <PrimaryButton
          disabled={!gate}
          label="Manual fallback"
          onPress={() => router.push('/fallback')}
          tone="ghost"
        />
        <PrimaryButton
          disabled={!gate}
          label="Settings"
          onPress={() => router.push('/settings')}
          tone="ghost"
        />
        <PrimaryButton
          disabled={!gate}
          label="Export logs"
          onPress={() => router.push('/export')}
          tone="ghost"
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  eyebrow: {
    ...typography.title,
    color: palette.highlight,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  hero: {
    gap: 10,
    paddingTop: 8,
  },
  subtitle: {
    ...typography.body,
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    ...typography.display,
    color: palette.ink,
    fontSize: 34,
    lineHeight: 38,
  },
});
