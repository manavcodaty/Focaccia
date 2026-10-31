import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { THEME } from '@/lib/theme';
import { useGate } from '@/state/gate-context';

export default function FallbackScreen() {
  const router = useRouter();
  const { gate, processToken } = useGate();
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [token, setToken] = useState('');

  async function handleSubmit() {
    setError(null);
    setIsBusy(true);

    try {
      const decision = await processToken(token, Date.now());

      router.replace(decision ? '/result' : '/face-match');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Token rejected.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <ScreenShell>
      <Text variant="h1">Manual entry</Text>
      {!gate ? <InlineAlert message="Needs setup" /> : null}
      {error ? <InlineAlert message={error} /> : null}
      <Textarea
        accessibilityLabel="Full pass token"
        autoCapitalize="none"
        autoCorrect={false}
        className="min-h-48"
        onChangeText={setToken}
        placeholder="Pass token"
        value={token}
      />
      <Button
        disabled={!gate || !token.trim() || isBusy}
        onPress={() => {
          void handleSubmit();
        }}
      >
        {isBusy ? <ActivityIndicator color={THEME.light.primaryForeground} /> : null}
        <Text>Verify</Text>
      </Button>
    </ScreenShell>
  );
}
