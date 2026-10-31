import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { QrCodeIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { EmptyState } from '@/components/empty-state';
import { EventMeta } from '@/components/event-meta';
import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { enrollmentApi } from '@/lib/api';
import { THEME } from '@/lib/theme';
import { useResponsiveLayout } from '@/lib/use-responsive-layout';
import { useEnrollment } from '@/state/enrollment-context';

const PASS_TOKEN_CLIPBOARD_TTL_MS = 60_000;

async function copyPassTokenToClipboard(
  token: string,
  onCopied: () => void,
  setTimer: typeof setTimeout = setTimeout,
) {
  await Clipboard.setStringAsync(token);
  onCopied();
  setTimer(() => {
    void Clipboard.getStringAsync()
      .then((currentValue) => {
        if (currentValue === token) {
          return Clipboard.setStringAsync('');
        }
        return undefined;
      })
      .catch(() => undefined);
  }, PASS_TOKEN_CLIPBOARD_TTL_MS);
}

export default function PassScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { setBundle, state } = useEnrollment();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const pass = state.pass;
  const ticket = state.selectedTicket;

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!pass) {
    return (
      <ScreenShell>
        <EmptyState icon={QrCodeIcon} title="No pass on this phone">
          <Button onPress={() => router.replace('/tickets')}><Text>My tickets</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  const remaining = Math.max(0, 3 - pass.generation);

  async function prepareRegeneration() {
    if (!ticket) return;
    setIsPreparing(true);
    setError(null);
    try {
      const bundle = await enrollmentApi.getEnrollmentBundle({ ticketId: ticket.id });
      setBundle(bundle, 'regeneration');
      router.push('/consent');
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : 'Unable to prepare regeneration.');
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <ScreenShell>
      <View className="gap-4">
        <Text variant="h1">{pass.event.name}</Text>
        <EventMeta event={pass.event} />
      </View>

      <Card accessibilityLabel="Event pass QR code">
        <CardContent className="items-center gap-4">
          <QRCode backgroundColor={THEME.light.card} color={THEME.light.foreground} quietZone={12} size={layout.qrSize} value={pass.token} />
          {pass.queueCode ? (
            <Text className="text-xl font-medium tracking-widest" selectable>{pass.queueCode}</Text>
          ) : null}
        </CardContent>
      </Card>

      {error ? <InlineAlert message={error} /> : null}

      <View className="gap-3">
        <Button
          accessibilityLabel="Copy pass token"
          onPress={() => {
            void copyPassTokenToClipboard(pass.token, () => setCopied(true));
          }}
          variant="outline"
        >
          <Text>{copied ? 'Copied' : 'Copy token'}</Text>
        </Button>
        {ticket && remaining > 0 ? (
          <Button
            disabled={isPreparing}
            onPress={() => Alert.alert('Regenerate pass?', 'Your current pass will be replaced.', [
              { style: 'cancel', text: 'Cancel' },
              { onPress: () => void prepareRegeneration(), style: 'destructive', text: 'Regenerate' },
            ])}
            variant="outline"
          >
            {isPreparing ? <ActivityIndicator color={THEME.light.foreground} /> : null}
            <Text>Regenerate</Text>
          </Button>
        ) : null}
        <Button onPress={() => router.replace('/tickets')}><Text>Done</Text></Button>
      </View>
    </ScreenShell>
  );
}
