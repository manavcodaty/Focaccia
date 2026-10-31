import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { CheckIcon, CopyIcon, TicketXIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { EventMeta } from '@/components/event-meta';
import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { StatusText } from '@/components/status-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { enrollmentApi } from '@/lib/api';
import { THEME } from '@/lib/theme';
import { checkedInConfirmation, generationAllowance, ticketAction } from '@/lib/ticket-state';
import { useEnrollment } from '@/state/enrollment-context';

const APPROVED_ROUTE = '/approved' as Href;

function confirmRegenerate(onConfirm: () => void) {
  Alert.alert('Regenerate pass?', 'Your current pass will be replaced.', [
    { style: 'cancel', text: 'Cancel' },
    { onPress: onConfirm, style: 'destructive', text: 'Regenerate' },
  ]);
}

export default function TicketDetailScreen() {
  const router = useRouter();
  const { setBundle, state } = useEnrollment();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const ticket = state.selectedTicket;

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!ticket) {
    return (
      <ScreenShell>
        <EmptyState icon={TicketXIcon} title="No ticket selected">
          <Button onPress={() => router.replace('/tickets')}><Text>My tickets</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  const action = ticketAction(ticket, state.pass);
  const allowance = generationAllowance(ticket.generation_count);
  const confirmation = checkedInConfirmation(ticket);

  async function startEnrollment(intent: 'initial' | 'regeneration') {
    setIsLoading(true);
    setError(null);
    try {
      const bundle = await enrollmentApi.getEnrollmentBundle({ ticketId: ticket!.id });
      setBundle(bundle, intent);
      router.push('/consent');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to prepare enrollment.');
    } finally {
      setIsLoading(false);
    }
  }

  const spinner = <ActivityIndicator color={THEME.light.primaryForeground} />;

  return (
    <ScreenShell>
      <View className="gap-4">
        <Text variant="h1">{ticket.event.name}</Text>
        <EventMeta event={ticket.event} />
      </View>

      <Card accessibilityLabel="Ticket" className="gap-0 overflow-hidden py-0">
        <View className="flex-row items-center justify-between gap-4 px-4 py-3">
          <Text className="flex-1 font-medium" numberOfLines={1}>{ticket.ticket_type.name}</Text>
          <StatusText className="shrink" status={ticket.status} />
        </View>
        <Separator />
        <View className="bg-muted/40 flex-row items-center justify-between gap-4 px-4 py-3">
          <View className="flex-1 gap-1">
            <Text className="text-muted-foreground text-sm">Claim code</Text>
            <Text adjustsFontSizeToFit className="text-xl font-medium tracking-wider" numberOfLines={1} selectable>
              {ticket.claim_code || (ticket.claim_code_hint ? `•••• ${ticket.claim_code_hint}` : '—')}
            </Text>
          </View>
          {ticket.claim_code ? (
            <Button
              accessibilityLabel="Copy claim code"
              onPress={() => {
                void Clipboard.setStringAsync(ticket.claim_code).then(() => setCopied(true));
              }}
              size="icon"
              variant="outline"
            >
              <Icon as={copied ? CheckIcon : CopyIcon} size={16} />
            </Button>
          ) : null}
        </View>
      </Card>

      {error ? <InlineAlert message={error} /> : null}

      <View className="gap-3">
        {action === 'enroll' ? (
          <Button disabled={isLoading} onPress={() => void startEnrollment('initial')}>
            {isLoading ? spinner : null}
            <Text>Create pass</Text>
          </Button>
        ) : null}
        {action === 'show-pass' ? (
          <>
            <Button onPress={() => router.push('/pass')}><Text>Show pass</Text></Button>
            {allowance.remaining > 0 ? (
              <Button
                disabled={isLoading}
                onPress={() => confirmRegenerate(() => void startEnrollment('regeneration'))}
                variant="outline"
              >
                <Text>Regenerate</Text>
              </Button>
            ) : null}
          </>
        ) : null}
        {action === 'regenerate' ? (
          <Button disabled={isLoading} onPress={() => confirmRegenerate(() => void startEnrollment('regeneration'))}>
            {isLoading ? spinner : null}
            <Text>Regenerate pass</Text>
          </Button>
        ) : null}
        {action === 'generation-limit' ? (
          <Button disabled><Text>Limit reached</Text></Button>
        ) : null}
        {confirmation ? (
          <Button onPress={() => router.push(APPROVED_ROUTE)}><Text>View receipt</Text></Button>
        ) : null}
      </View>
    </ScreenShell>
  );
}
