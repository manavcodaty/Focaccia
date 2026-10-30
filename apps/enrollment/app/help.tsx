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
          Sign in with your ticket account.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Privacy" title="What the app keeps" tone="subtle">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          Face processing stays local. Temporary captures are deleted best-effort after processing; face data is not saved to your account.
        </Text>
      </SectionCard>

      <SectionCard title="For the best face capture">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          1. Use even lighting. Keep eyes visible.
        </Text>
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          2. Hold at eye level. Center your face.
        </Text>
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          3. Hold still until your pass is ready.
        </Text>
      </SectionCard>

      <SectionCard title="QR not scanning?">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          Copy the full pass token for gate staff.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Offline limitation" title="Refresh revocations">
        <Text style={[styles.bodyText, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          Offline revocations apply after the gate reconnects and refreshes.
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
