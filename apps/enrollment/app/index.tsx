import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchEnrollmentBundle, FunctionApiError } from '../src/lib/api';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette } from '../src/theme';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';

function normalizeJoinCodeInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function describeJoinCodeError(error: unknown): string {
  if (error instanceof FunctionApiError) {
    switch (error.code) {
      case 'invalid_join_code':
        return 'Enter the 8-character join code exactly as it appears in the dashboard.';
      case 'event_not_found':
        return 'That join code did not match any active event.';
      case 'gate_not_provisioned':
        return 'This event is not yet provisioned for gate verification.';
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : 'Unable to load the enrollment bundle.';
}

export default function JoinCodeScreen() {
  const router = useRouter();
  const { reset, setBundle, state } = useEnrollment();
  const [joinCode, setJoinCode] = useState(state.joinCode);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'neutral' | 'success' | 'warning'>('neutral');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    const normalized = normalizeJoinCodeInput(joinCode);

    if (normalized.length !== 8) {
      setStatusTone('warning');
      setStatusMessage('Join codes are eight uppercase letters or numbers.');
      return;
    }

    setIsSubmitting(true);
    setStatusTone('neutral');
    setStatusMessage('Checking event details and gate readiness...');

    try {
      reset();
      const bundle = await fetchEnrollmentBundle(normalized);
      setBundle(normalized, bundle);
      setStatusTone('success');
      setStatusMessage('Enrollment bundle loaded. Review privacy details next.');
      router.push('/consent');
    } catch (error) {
      setStatusTone('warning');
      setStatusMessage(describeJoinCodeError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenShell style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>One-Time Face Pass</Text>
        <Text style={styles.title}>Join an event securely on your own phone.</Text>
        <Text style={styles.subtitle}>
          Your face is processed on-device, transformed into an event-scoped template, and never uploaded as an image.
        </Text>
      </View>

      <SectionCard eyebrow="Start" title="Enter your join code">
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Event join code</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="ascii-capable"
            maxLength={8}
            onChangeText={(value) => setJoinCode(normalizeJoinCodeInput(value))}
            placeholder="AB12CD34"
            placeholderTextColor="#9a9fb0"
            returnKeyType="done"
            style={styles.input}
            value={joinCode}
          />
        </View>

        {statusMessage ? <StatusBanner message={statusMessage} tone={statusTone} /> : null}

        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? 'Checking event...' : 'Continue'}
          onPress={() => {
            void handleContinue();
          }}
        />
      </SectionCard>

      <SectionCard eyebrow="Privacy" title="What happens next">
        <Text style={styles.bodyText}>
          You will review consent, capture your face once, and receive a signed QR token for this event only.
        </Text>
        <Text style={styles.bodyText}>
          If scanning fails later, the app also exposes the full token for manual copy or paste at the gate.
        </Text>
      </SectionCard>

      <Pressable accessibilityRole="link" onPress={() => router.push('/help')}>
        <Text style={styles.helpLink}>Need help finding your join code or understanding the process?</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  helpLink: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  hero: {
    gap: 10,
    paddingTop: 10,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 3,
    minHeight: 62,
    paddingHorizontal: 18,
    textAlign: 'center',
  },
  inputGroup: {
    gap: 8,
  },
  kicker: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  label: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  screen: {
    gap: 18,
    justifyContent: 'center',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    color: palette.ink,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
  },
});
