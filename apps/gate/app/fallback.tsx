import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { scaleFont } from '../src/lib/responsive-metrics';
import { useResponsiveLayout } from '../src/lib/use-responsive-layout';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

export default function FallbackScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { gate, processToken } = useGate();
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [token, setToken] = useState('');

  async function handleSubmit() {
    setError(null);
    setIsBusy(true);

    try {
      const decision = await processToken(token, Date.now());

      router.replace(decision ? '/result' : '/liveness');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Manual verification failed.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <ScreenShell>
      <SectionCard eyebrow="Fallback" title="Paste the full pass token">
        <Text style={[styles.body, { fontSize: scaleFont(layout, 15), lineHeight: scaleFont(layout, 22) }]}>
          This screen accepts the full QR token text when optical scanning fails. The short queue
          code is not enough to reconstruct a pass offline.
        </Text>
        {!gate ? (
          <StatusBanner
            message="Provision the gate before using manual fallback."
            tone="warning"
          />
        ) : null}
        {error ? <StatusBanner message={error} tone="danger" /> : null}
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          onChangeText={setToken}
          placeholder="eyJ2IjoxLCJldmVudF9pZCI6Ii4uLiJ9.signature"
          placeholderTextColor={palette.muted}
          style={[
            styles.tokenInput,
            {
              fontSize: scaleFont(layout, 15),
              minHeight: layout.isTablet ? 220 : 180,
            },
          ]}
          value={token}
        />
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          disabled={!gate || !token.trim() || isBusy}
          label={isBusy ? 'Verifying token...' : 'Verify token offline'}
          onPress={() => {
            void handleSubmit();
          }}
        />
        <PrimaryButton label="Back to scanner" onPress={() => router.replace('/scan')} tone="ghost" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  body: {
    ...typography.body,
    color: palette.ink,
  },
  tokenInput: {
    ...typography.body,
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    color: palette.ink,
    padding: 16,
    textAlignVertical: 'top',
  },
});
