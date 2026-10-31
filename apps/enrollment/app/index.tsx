import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import type { AuthMode } from '@/lib/auth-validation';
import { THEME } from '@/lib/theme';
import { useAuth } from '@/state/auth-context';

export default function AuthScreen() {
  const router = useRouter();
  const { error, isLoading, session, signInOrUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const signingIn = mode === 'sign-in';

  useEffect(() => {
    if (session) router.replace('/tickets');
  }, [router, session]);

  async function handleSubmit() {
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
      <View accessibilityLabel="Signing in" className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator color={THEME.light.foreground} />
      </View>
    );
  }

  return (
    <ScreenShell className="justify-center gap-6" header={false}>
      <View className="items-center gap-4">
        <BrandLogo />
        <Text variant="h1">{signingIn ? 'Sign in' : 'Create account'}</Text>
      </View>

      <Card>
        <CardContent className="gap-4">
          {mode === 'sign-up' ? (
            <View className="gap-2">
              <Label nativeID="full-name">Full name</Label>
              <Input
                accessibilityLabel="Full name"
                aria-labelledby="full-name"
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={setFullName}
                textContentType="name"
                value={fullName}
              />
            </View>
          ) : null}

          <View className="gap-2">
            <Label nativeID="email">Email</Label>
            <Input
              accessibilityLabel="Email"
              aria-labelledby="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
          </View>

          <View className="gap-2">
            <Label nativeID="password">Password</Label>
            <Input
              accessibilityLabel="Password"
              aria-labelledby="password"
              autoCapitalize="none"
              autoComplete={signingIn ? 'current-password' : 'new-password'}
              onChangeText={setPassword}
              onSubmitEditing={() => void handleSubmit()}
              returnKeyType="done"
              secureTextEntry
              textContentType={signingIn ? 'password' : 'newPassword'}
              value={password}
            />
          </View>

          {error ? <InlineAlert message={error} /> : null}

          <Button disabled={isLoading} onPress={() => void handleSubmit()}>
            {isLoading ? <ActivityIndicator color={THEME.light.primaryForeground} /> : null}
            <Text>{signingIn ? 'Sign in' : 'Create account'}</Text>
          </Button>
        </CardContent>
      </Card>

      <Button
        className="self-center"
        onPress={() => setMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'))}
        size="sm"
        variant="link"
      >
        <Text className="text-muted-foreground">{signingIn ? 'Create account' : 'Sign in'}</Text>
      </Button>
    </ScreenShell>
  );
}
