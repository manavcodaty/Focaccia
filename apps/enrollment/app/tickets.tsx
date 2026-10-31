import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { CheckIcon, CopyIcon, TicketIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InlineAlert } from '@/components/inline-alert';
import { Section } from '@/components/section';
import { TicketRow } from '@/components/ticket-row';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { enrollmentApi, FunctionApiError } from '@/lib/api';
import { passVault } from '@/lib/enrollment-storage';
import { THEME } from '@/lib/theme';
import {
  reconcilePassWithTicket,
  type EnrollmentTicket,
  type StoredEnrollmentPass,
} from '@/lib/ticket-state';
import { useAuth } from '@/state/auth-context';
import { useEnrollment } from '@/state/enrollment-context';

const APPROVED_ROUTE = '/approved' as Href;

function ticketFromStoredPass(pass: StoredEnrollmentPass): EnrollmentTicket {
  return {
    cancelled_at: null,
    checked_in_at: null,
    claim_code: '',
    claim_code_hint: '',
    claimed_at: pass.createdAtIso,
    created_at: pass.createdAtIso,
    current_pass_id: pass.passId,
    enrolled_at: pass.createdAtIso,
    event: pass.event,
    event_id: pass.event.event_id,
    generation_count: pass.generation,
    id: pass.ticketId,
    revoked_at: null,
    status: 'enrolled',
    ticket_type: {
      currency: 'GBP',
      id: 'offline-ticket-type',
      name: pass.ticketTypeName,
      price_pence: 0,
    },
    ticket_type_id: 'offline-ticket-type',
    updated_at: pass.createdAtIso,
  };
}

function claimCodeMessage(error: unknown): string {
  if (error instanceof FunctionApiError) {
    if (error.code === 'ticket_not_found') return 'Ticket not found in this account.';
    if (error.code === 'rate_limit_exceeded') return 'Too many attempts. Try again later.';
  }
  return error instanceof Error ? error.message : 'Ticket not found.';
}

export default function TicketsScreen() {
  const router = useRouter();
  const { session, signOut, user } = useAuth();
  const { reset, selectTicket } = useEnrollment();
  const [tickets, setTickets] = useState<EnrollmentTicket[]>([]);
  const [passes, setPasses] = useState<Record<string, StoredEnrollmentPass>>({});
  const [claimCode, setClaimCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    if (!emailCopied) return undefined;
    const timer = setTimeout(() => setEmailCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [emailCopied]);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setIsRefreshing(true);
    setMessage(null);
    const localPasses = await passVault.listPasses(user.id);
    const localByTicket = Object.fromEntries(localPasses.map((pass) => [pass.ticketId, pass]));
    setPasses(localByTicket);

    try {
      const response = await enrollmentApi.listMyTickets();
      const resetEvents: string[] = [];
      const discardedTicketIds = new Set<string>();
      for (const ticket of response.tickets) {
        const localPass = localByTicket[ticket.id] ?? null;
        const reconciliation = reconcilePassWithTicket(ticket, localPass);
        if (reconciliation.discardPass) {
          await Promise.all([
            passVault.removePass(user.id, ticket.id),
            passVault.removePending(user.id, ticket.id),
          ]);
          discardedTicketIds.add(ticket.id);
          if (reconciliation.reason === 'organizer-reset') resetEvents.push(ticket.event.name);
        }
      }
      const nextPasses = Object.fromEntries(
        Object.entries(localByTicket).filter(([ticketId]) => !discardedTicketIds.has(ticketId)),
      );
      setPasses(nextPasses);
      setTickets(response.tickets);
      if (resetEvents.length > 0) {
        setMessage(`${resetEvents.join(', ')} reset. Enroll again.`);
      }
    } catch (error) {
      setTickets(localPasses.map(ticketFromStoredPass));
      setMessage(localPasses.length > 0
        ? 'Offline. Showing saved passes.'
        : error instanceof Error ? error.message : 'Unable to load tickets.');
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    if (!session) {
      router.replace('/');
      return;
    }
    void loadTickets();
  }, [loadTickets, router, session]));

  const findTicket = useCallback(async () => {
    setIsClaiming(true);
    setMessage(null);
    try {
      const selection = await enrollmentApi.getEnrollmentBundle({ claimCode });
      const response = await enrollmentApi.listMyTickets();
      const ticket = response.tickets.find((item) => item.id === selection.ticket.id);
      if (!ticket) throw new Error('Ticket not found.');
      selectTicket(ticket, passes[ticket.id] ?? null);
      router.push('/ticket');
    } catch (error) {
      setMessage(claimCodeMessage(error));
    } finally {
      setIsClaiming(false);
    }
  }, [claimCode, passes, router, selectTicket]);

  const renderTicket = useCallback(({ item }: { item: EnrollmentTicket }) => (
    <TicketRow
      onPress={() => {
        selectTicket(item, passes[item.id] ?? null);
        router.push(item.status === 'checked_in' ? APPROVED_ROUTE : '/ticket');
      }}
      ticket={item}
    />
  ), [passes, router, selectTicket]);

  const header = useMemo(() => (
    <View className="gap-6 pb-4">
      <Text variant="h1">My tickets</Text>
      {message ? <InlineAlert message={message} tone="default" /> : null}
    </View>
  ), [message]);

  const footer = (
    <View className="gap-8 pt-8">
      <Section title="Claim code">
        <View className="flex-row gap-2">
          <Input
            accessibilityLabel="Claim code"
            autoCapitalize="characters"
            autoCorrect={false}
            className="flex-1 tracking-widest"
            onChangeText={(value) => setClaimCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14))}
            onSubmitEditing={() => { if (claimCode.length === 14) void findTicket(); }}
            placeholder="ABCD-EFGH-JKLM"
            returnKeyType="go"
            value={claimCode}
          />
          <Button
            accessibilityLabel="Find ticket"
            disabled={isClaiming || claimCode.length < 14}
            onPress={() => void findTicket()}
            variant="outline"
          >
            {isClaiming ? <ActivityIndicator color={THEME.light.foreground} /> : <Text>Find</Text>}
          </Button>
        </View>
      </Section>

      <Section title="Account">
        <View className="border-border flex-row items-center gap-3 rounded-lg border py-1 pl-3 pr-1">
          <Text className="flex-1 text-sm" numberOfLines={1}>{user?.email}</Text>
          <Button
            accessibilityLabel="Copy account email"
            onPress={() => {
              void Clipboard.setStringAsync(user?.email ?? '').then(() => setEmailCopied(true));
            }}
            size="icon"
            variant="ghost"
          >
            <Icon as={emailCopied ? CheckIcon : CopyIcon} size={16} />
          </Button>
        </View>
        <Button
          onPress={() => {
            reset();
            void signOut().then(() => router.replace('/'));
          }}
          variant="outline"
        >
          <Text>Log out</Text>
        </Button>
        <Button
          accessibilityLabel="Switch attendee"
          onPress={() => Alert.alert(
            'Switch attendee?',
            'Saved passes on this phone will be removed.',
            [
              { style: 'cancel', text: 'Cancel' },
              {
                onPress: () => {
                  reset();
                  void signOut({ clearLocalData: true }).then(() => router.replace('/'));
                },
                style: 'destructive',
                text: 'Remove and switch',
              },
            ],
          )}
          variant="destructive"
        >
          <Text>Switch attendee</Text>
        </Button>
      </Section>
    </View>
  );

  if (!session) return null;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ backgroundColor: THEME.light.background, flex: 1 }}>
      <FlatList
        contentContainerClassName="w-full max-w-[620px] grow self-center px-5 pb-6 pt-6"
        data={tickets}
        ItemSeparatorComponent={() => <View className="h-3" />}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={isRefreshing ? null : (
          <View className="border-border items-center gap-3 rounded-xl border border-dashed px-6 py-10">
            <View className="bg-muted h-10 w-10 items-center justify-center rounded-lg">
              <Icon as={TicketIcon} size={20} />
            </View>
            <Text className="font-medium">No tickets</Text>
          </View>
        )}
        ListFooterComponent={footer}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl onRefresh={() => void loadTickets()} refreshing={isRefreshing} tintColor={THEME.light.foreground} />}
        renderItem={renderTicket}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
