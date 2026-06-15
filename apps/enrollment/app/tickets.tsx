import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../src/components/primary-button';
import { StatusBanner } from '../src/components/status-banner';
import { TicketRow } from '../src/components/ticket-row';
import { enrollmentApi, FunctionApiError } from '../src/lib/api';
import { passVault } from '../src/lib/enrollment-storage';
import {
  reconcilePassWithTicket,
  type EnrollmentTicket,
  type StoredEnrollmentPass,
} from '../src/lib/ticket-state';
import { useAuth } from '../src/state/auth-context';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, typography } from '../src/theme';

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
    if (error.code === 'ticket_not_found') {
      return 'That ticket is not available for enrollment in this account.';
    }
    if (error.code === 'rate_limit_exceeded') {
      return 'Too many claim-code attempts. Wait before trying again.';
    }
  }
  return error instanceof Error ? error.message : 'Unable to look up that ticket.';
}

export default function TicketsScreen() {
  const router = useRouter();
  const { session, signOut, user } = useAuth();
  const { reset, selectTicket } = useEnrollment();
  const [tickets, setTickets] = useState<EnrollmentTicket[]>([]);
  const [passes, setPasses] = useState<Record<string, StoredEnrollmentPass>>({});
  const [offlineTicketIds, setOfflineTicketIds] = useState<Set<string>>(new Set());
  const [claimCode, setClaimCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

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
      setOfflineTicketIds(new Set());
      if (resetEvents.length > 0) {
        setMessage(`The organizer reset ${resetEvents.join(', ')}. The old pass was removed and the ticket is ready to enroll again.`);
      }
    } catch (error) {
      setTickets(localPasses.map(ticketFromStoredPass));
      setOfflineTicketIds(new Set(localPasses.map((pass) => pass.ticketId)));
      setMessage(localPasses.length > 0
        ? 'The service is unreachable. Securely saved passes remain available offline.'
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

  const renderTicket = useCallback(({ item }: { item: EnrollmentTicket }) => (
    <TicketRow
      offline={offlineTicketIds.has(item.id)}
      onPress={() => {
        selectTicket(item, passes[item.id] ?? null);
        router.push('/ticket');
      }}
      ticket={item}
    />
  ), [offlineTicketIds, passes, router, selectTicket]);

  const header = useMemo(() => (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>My tickets</Text>
          <Text style={styles.account} numberOfLines={1}>{user?.email}</Text>
        </View>
        <Pressable
          accessibilityLabel="Switch attendee"
          accessibilityRole="button"
          onPress={() => Alert.alert(
            'Switch attendee?',
            'This removes this attendee’s locally saved passes and pending enrollment from this prepared device before signing out.',
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
          style={({ pressed }) => [styles.accountButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.accountButtonLabel}>Switch</Text>
        </Pressable>
      </View>

      <View style={styles.claimBlock}>
        <Text style={styles.claimTitle}>Enter an owned claim code</Text>
        <Text style={styles.claimHelp}>A code never replaces sign-in. The backend also verifies that this account owns the ticket.</Text>
        <TextInput
          accessibilityLabel="Owned ticket claim code"
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={(value) => setClaimCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14))}
          placeholder="ABCD-EFGH-JKLM"
          placeholderTextColor={palette.hintOfGrey}
          returnKeyType="go"
          style={styles.claimInput}
          value={claimCode}
        />
        <PrimaryButton
          disabled={isClaiming || claimCode.length < 14}
          label={isClaiming ? 'Checking ticket...' : 'Find my ticket'}
          onPress={() => {
            void (async () => {
              setIsClaiming(true);
              setMessage(null);
              try {
                const selection = await enrollmentApi.getEnrollmentBundle({ claimCode });
                const response = await enrollmentApi.listMyTickets();
                const ticket = response.tickets.find((item) => item.id === selection.ticket.id);
                if (!ticket) throw new Error('The owned ticket could not be loaded.');
                selectTicket(ticket, passes[ticket.id] ?? null);
                router.push('/ticket');
              } catch (error) {
                setMessage(claimCodeMessage(error));
              } finally {
                setIsClaiming(false);
              }
            })();
          }}
        />
      </View>

      {message ? <StatusBanner message={message} tone="warning" /> : null}
      <View style={styles.listHeading}>
        <Text style={styles.listTitle}>Your tickets</Text>
        <Text style={styles.listHint}>Pull down to refresh organizer changes.</Text>
      </View>
    </View>
  ), [claimCode, isClaiming, message, passes, reset, router, selectTicket, signOut, user?.email]);

  if (!session) return null;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={tickets}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={isRefreshing ? null : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No tickets yet</Text>
            <Text style={styles.emptyBody}>Use the public ticket site to claim a free ticket, then refresh this list.</Text>
          </View>
        )}
        ListFooterComponent={(
          <View style={styles.footer}>
            <PrimaryButton
              label="Log out"
              onPress={() => {
                reset();
                void signOut().then(() => router.replace('/'));
              }}
              tone="ghost"
            />
            <Pressable
              accessibilityLabel="Copy account email"
              accessibilityRole="button"
              onPress={() => void Clipboard.setStringAsync(user?.email ?? '')}
              style={({ pressed }) => [styles.copyAccount, pressed ? styles.pressed : null]}
            >
              <Text style={styles.copyAccountText}>Copy account email</Text>
            </Pressable>
          </View>
        )}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl onRefresh={() => void loadTickets()} refreshing={isRefreshing} tintColor={palette.ink} />}
        renderItem={renderTicket}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  account: { ...typography.body, color: palette.mutedStone, fontSize: 13 },
  accountButton: {
    alignItems: 'center',
    borderColor: palette.ink,
    borderRadius: 9999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  accountButtonLabel: { ...typography.bodyStrong, color: palette.ink, fontSize: 14 },
  claimBlock: { backgroundColor: palette.fog, borderRadius: 24, gap: 12, padding: 18 },
  claimHelp: { ...typography.body, color: palette.mutedStone, fontSize: 13, lineHeight: 19 },
  claimInput: {
    ...typography.bodyStrong,
    backgroundColor: palette.canvas,
    borderColor: palette.hintOfGrey,
    borderRadius: 16,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 18,
    letterSpacing: 1.1,
    minHeight: 52,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  claimTitle: { ...typography.title, color: palette.ink, fontSize: 18 },
  copyAccount: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  copyAccountText: { ...typography.bodyStrong, color: palette.terracotta, fontSize: 14 },
  emptyBody: { ...typography.body, color: palette.mutedStone, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyState: { alignItems: 'center', backgroundColor: palette.fog, borderRadius: 24, gap: 8, padding: 28 },
  emptyTitle: { ...typography.title, color: palette.ink, fontSize: 20 },
  footer: { gap: 12, paddingBottom: 20, paddingTop: 28 },
  header: { gap: 20, paddingBottom: 18 },
  listContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 10 },
  listHeading: { gap: 4 },
  listHint: { ...typography.body, color: palette.mutedStone, fontSize: 13 },
  listTitle: { ...typography.title, color: palette.ink, fontSize: 20 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  safeArea: { backgroundColor: palette.canvas, flex: 1 },
  separator: { height: 12 },
  title: { ...typography.display, color: palette.ink, fontSize: 34, lineHeight: 40 },
  titleBlock: { flex: 1, gap: 2 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 16 },
});
