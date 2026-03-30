import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette } from '../src/theme';

export default function ConsentScreen() {
  const router = useRouter();
  const { acceptConsent, reset, state } = useEnrollment();

  if (!state.bundle) {
    return (
      <ScreenShell style={styles.screen}>
        <SectionCard eyebrow="Missing event" title="Start from the join code screen">
          <Text style={styles.bodyText}>
            The event bundle is not loaded yet, so enrollment cannot continue from here.
          </Text>
          <PrimaryButton
            label="Back to join code"
            onPress={() => {
              reset();
              router.replace('/');
            }}
          />
        </SectionCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.screen}>
      <SectionCard eyebrow="Consent" title="Review how your pass is created">
        <Text style={styles.bodyText}>
          Your face stays on this phone while the app generates a one-time, event-scoped template.
        </Text>
        <Text style={styles.bodyText}>
          No face image is uploaded, no reusable embedding is stored, and the final pass can only be verified for {state.bundle.event_id}.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Event" title="Enrollment details">
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Join code</Text>
          <Text style={styles.detailValue}>{state.joinCode}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Event ID</Text>
          <Text style={styles.detailValue}>{state.bundle.event_id}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Valid until</Text>
          <Text style={styles.detailValue}>{new Date(state.bundle.ends_at).toLocaleString()}</Text>
        </View>
      </SectionCard>

      <SectionCard eyebrow="Before camera starts" title="What you are agreeing to">
        <Text style={styles.bodyText}>1. The app will request camera access only on the next screen.</Text>
        <Text style={styles.bodyText}>2. The captured face image is used in memory to issue this pass and is not retained.</Text>
        <Text style={styles.bodyText}>3. The pass is single-use and intended only for this event and gate.</Text>
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          label="I consent and continue"
          onPress={() => {
            acceptConsent();
            router.push('/capture');
          }}
        />
        <PrimaryButton label="Back" onPress={() => router.back()} tone="ghost" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  bodyText: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 23,
  },
  detailLabel: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  detailRow: {
    gap: 4,
  },
  detailValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  screen: {
    gap: 18,
    justifyContent: 'center',
  },
});
