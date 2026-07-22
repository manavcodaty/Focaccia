import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { scaleFont } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { palette, typography } from '../src/theme';

export default function HelpScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();

  return (
    <ScreenShell style={styles.screen}>
      <SectionCard title="Enrollment support">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          Sign in with the account that claimed the ticket. My tickets lists every ticket owned by that account, and an optional claim code can select only a ticket that the same account owns.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Privacy" title="What the app keeps" tone="subtle">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          Face processing runs on-device. Camera capture can create a temporary file that is deleted best-effort after inference. Raw face images and reusable embeddings are not stored as account records.
        </Text>
      </SectionCard>

      <SectionCard title="For the best face capture">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          1. Use even lighting and remove anything blocking your eyes.
        </Text>
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          2. Hold the phone at eye level and keep your face centered.
        </Text>
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          3. Stay still until the app finishes generating the pass.
        </Text>
      </SectionCard>

      <SectionCard title="If the QR cannot be scanned later">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          The pass screen includes a copy button for the full token. Gate staff can paste that exact token into the verifier app if camera scanning fails.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Offline limitation" title="Refreshes still matter">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          A disconnected gate uses its most recent revocation cache. A new organizer revocation cannot affect that gate until it reconnects and refreshes.
        </Text>
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton label="Back" onPress={() => router.back()} />
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
  screen: {
    gap: 18,
  },
});
