import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { scaleFont } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, typography } from '../src/theme';

export default function ConsentScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
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
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 23) }]}>
          Your face stays on this phone while the app generates a one-time, event-scoped template.
        </Text>
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 23) }]}>
          No face image is uploaded, no reusable embedding is stored, and the final pass can only be verified for {state.bundle.event_id}.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Event" title="Enrollment details">
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { fontSize: scaleFont(layout, 14) }]}>Join code</Text>
          <Text style={[styles.detailValue, { fontSize: scaleFont(layout, 16) }]}>{state.joinCode}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { fontSize: scaleFont(layout, 14) }]}>Event ID</Text>
          <Text style={[styles.detailValue, { fontSize: scaleFont(layout, 16) }]}>{state.bundle.event_id}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { fontSize: scaleFont(layout, 14) }]}>Valid until</Text>
          <Text style={[styles.detailValue, { fontSize: scaleFont(layout, 16) }]}>
            {new Date(state.bundle.ends_at).toLocaleString()}
          </Text>
        </View>
      </SectionCard>

      <SectionCard eyebrow="Before camera starts" title="What you are agreeing to">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 23) }]}>
          1. The app will request camera access only on the next screen.
        </Text>
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 23) }]}>
          2. The captured face image is used in memory to issue this pass and is not retained.
        </Text>
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 23) }]}>
          3. The pass is single-use and intended only for this event and gate.
        </Text>
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
    ...typography.body,
    color: palette.ink,
  },
  detailLabel: {
    ...typography.bodyStrong,
    color: palette.muted,
  },
  detailRow: {
    gap: 4,
  },
  detailValue: {
    ...typography.title,
    color: palette.ink,
  },
  screen: {
    gap: 18,
    justifyContent: 'center',
  },
});
