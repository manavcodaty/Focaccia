import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandLogo } from '../src/components/brand-logo';
import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { StatusBanner } from '../src/components/status-banner';
import type { AuthMode } from '../src/lib/auth-validation';
import { useAuth } from '../src/state/auth-context';
import { palette, radii, typography } from '../src/theme';

const isCloudE2E = process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1';

export default function AuthScreen() {
  const router = useRouter();
  const { error, isLoading, session, signInOrUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (session) router.replace('/tickets');
  }, [router, session]);

  async function handleSubmit() {
    // Let the native keyboard finish resigning before the auth state replaces
    // this form. Hosted iOS 26.5 can otherwise respawn backboardd while the
    // focused text field is being unmounted.
    Keyboard.dismiss();
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      await signInOrUp({
        email,
        ...(mode === 'sign-up' ? { fullName } : {}),
        mode,
        password,
      });
      router.replace('/tickets');
    } catch {
      // AuthProvider exposes the safe user-facing error.
    }
  }

  if (isLoading && session === null) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={palette.ink} />
        <Text style={styles.loadingText}>Restoring your secure session...</Text>
      </View>
    );
  }

  return (
    <ScreenShell style={styles.screen}>
      <View style={styles.brandBlock}>
        <BrandLogo />
        <Text style={styles.eyebrow}>Attendee wallet</Text>
        <Text style={styles.title}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'sign-in'
            ? 'Use the same account that holds your event ticket.'
            : 'Create the attendee account you will use for ticket checkout and enrollment.'}
        </Text>
      </View>

      <View style={styles.form}>
        {mode === 'sign-up' ? (
          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              accessibilityLabel="Full name"
              autoCapitalize="words"
              autoComplete="name"
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={palette.hintOfGrey}
              style={styles.input}
              textContentType="name"
              value={fullName}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={palette.hintOfGrey}
            returnKeyType="next"
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoComplete={isCloudE2E ? 'off' : mode === 'sign-in' ? 'current-password' : 'new-password'}
            onChangeText={setPassword}
            onSubmitEditing={() => void handleSubmit()}
            placeholder="At least eight characters"
            placeholderTextColor={palette.hintOfGrey}
            returnKeyType="done"
            secureTextEntry={!isCloudE2E}
            style={styles.input}
            textContentType={isCloudE2E ? 'none' : mode === 'sign-in' ? 'password' : 'newPassword'}
            value={password}
          />
        </View>

        {error ? <StatusBanner message={error} title="Sign-in problem" tone="warning" /> : null}

        <PrimaryButton
          disabled={isLoading}
          label={isLoading ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          onPress={() => void handleSubmit()}
        />
      </View>

      <View style={styles.switchBlock}>
        <Text style={styles.switchPrompt}>
          {mode === 'sign-in' ? 'New to Focaccia?' : 'Already have an account?'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in');
          }}
          style={({ pressed }) => [styles.switchButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.switchLabel}>
            {mode === 'sign-in' ? 'Create account' : 'Sign in instead'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.privacyCopy}>
        Face images and reusable embeddings never leave this phone. Your session and issued passes use iOS protected storage.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  brandBlock: { gap: 8, paddingTop: 12 },
  eyebrow: { ...typography.bodyStrong, color: palette.clay, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  field: { gap: 8 },
  form: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: 18,
    padding: 20,
  },
  input: {
    ...typography.body,
    backgroundColor: palette.surface,
    borderColor: palette.borderStrong,
    borderRadius: radii.field,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 17,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  label: { ...typography.bodyStrong, color: palette.ink, fontSize: 15 },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: palette.canvas,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  loadingText: { ...typography.body, color: palette.mutedStone, fontSize: 15 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  privacyCopy: {
    ...typography.body,
    color: palette.mutedStone,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  screen: { gap: 28, justifyContent: 'center' },
  subtitle: { ...typography.body, color: palette.mutedStone, fontSize: 16, lineHeight: 23 },
  switchBlock: { alignItems: 'center', gap: 8 },
  switchButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.borderStrong,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 24,
  },
  switchLabel: { ...typography.bodyStrong, color: palette.ink, fontSize: 15 },
  switchPrompt: { ...typography.body, color: palette.mutedStone, fontSize: 14 },
  title: { ...typography.display, color: palette.ink, fontSize: 36, letterSpacing: -0.6, lineHeight: 41 },
});
