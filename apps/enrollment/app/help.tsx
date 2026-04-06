import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { palette, typography } from '../src/theme';

export default function HelpScreen() {
  const router = useRouter();

  return (
    <ScreenShell style={styles.screen}>
      <SectionCard eyebrow="Help" title="Enrollment support">
        <Text style={styles.bodyText}>
          Ask the organizer for the eight-character join code shown in the dashboard. The code is required before any camera or crypto work starts.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Capture tips" title="For the best face capture">
        <Text style={styles.bodyText}>1. Use even lighting and remove anything blocking your eyes.</Text>
        <Text style={styles.bodyText}>2. Hold the phone at eye level and keep your face centered.</Text>
        <Text style={styles.bodyText}>3. Stay still until the app finishes generating the pass.</Text>
      </SectionCard>

      <SectionCard eyebrow="Fallback" title="If the QR cannot be scanned later">
        <Text style={styles.bodyText}>
          The pass screen includes a copy button for the full token. Gate staff can paste that exact token into the verifier app if camera scanning fails.
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
    fontSize: 15,
    lineHeight: 22,
  },
  screen: {
    gap: 18,
  },
});
