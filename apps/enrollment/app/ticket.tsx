import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { enrollmentApi } from '../src/lib/api';
import {
  checkedInConfirmation,
  generationAllowance,
  ticketAction,
  ticketStatusPresentation,
} from '../src/lib/ticket-state';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, radii, typography } from '../src/theme';

const APPROVED_ROUTE = '/approved' as Href;
const isCloudE2E = process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1';

export default function TicketDetailScreen() {
  const router = useRouter();
  const { setBundle, state } = useEnrollment();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const ticket = state.selectedTicket;

  if (!ticket) {
    return (
      <ScreenShell style={styles.screen}>
        <SectionCard title="Select a ticket first">
          <Text style={styles.body}>Return to My tickets and choose the ticket you want to use.</Text>
          <PrimaryButton label="Back to My tickets" onPress={() => router.replace('/tickets')} />
        </SectionCard>
      </ScreenShell>
    );
  }

  const action = ticketAction(ticket, state.pass);
  const status = ticketStatusPresentation(ticket.status);
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

  const createPassButton = action === 'enroll' ? (
    <PrimaryButton disabled={isLoading} label={isLoading ? 'Preparing…' : 'Create event pass'} onPress={() => void startEnrollment('initial')} />
  ) : null;

  return (
    <ScreenShell style={styles.screen}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventName}>{ticket.event.name}</Text>
        <Text style={styles.eventMeta}>{ticket.event.location || 'Location to be confirmed'}</Text>
        <Text style={styles.eventMeta}>{new Date(ticket.event.starts_at).toLocaleString()}</Text>
      </View>

      {isCloudE2E ? createPassButton : null}

      <SectionCard eyebrow="Credential state" title="Ticket details">
        <Detail label="Ticket type" value={ticket.ticket_type.name} />
        <Detail label="Status" value={status.label} />
        <Detail label="Generation" value={`${allowance.used} of 3 used`} />
        <View style={styles.allowanceTrack}>
          <View style={[styles.allowanceFill, { width: `${(allowance.used / 3) * 100}%` }]} />
        </View>
        <Text style={styles.mutedBody}>
          {allowance.remaining === 0
            ? 'No pass generations remain for this ticket.'
            : `You can generate ${allowance.remaining} more ${allowance.remaining === 1 ? 'pass' : 'passes'}.`}
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Privacy boundary" title="Processed on this phone" tone="subtle">
        <Text style={styles.body}>Capture and face processing happen on this phone. The server receives only an encrypted, event-scoped template inside the pass payload for signing.</Text>
        <Text style={styles.body}>The event organizer can see ticket and pass status, but not face images, embeddings, decrypted templates, passwords, or full pass tokens.</Text>
      </SectionCard>

      <SectionCard eyebrow="Account recovery" title="Claim code">
        <Text style={styles.claimCode}>{ticket.claim_code || 'Available when connected'}</Text>
        {ticket.claim_code ? (
          <PrimaryButton label="Copy claim code" onPress={() => void Clipboard.setStringAsync(ticket.claim_code)} tone="ghost" />
        ) : null}
      </SectionCard>

      {ticket.status === 'cancelled' ? <StatusBanner message="This ticket was cancelled and cannot be enrolled." title="Cancelled" tone="warning" /> : null}
      {ticket.status === 'revoked' ? <StatusBanner message="The organizer revoked this ticket. Any saved pass has been removed." title="Revoked" tone="danger" /> : null}
      {confirmation ? (
        <StatusBanner message="The gate has processed and approved this ticket. Open the approval receipt for the final record." title="Checked in" tone="success" />
      ) : null}
      {action === 'regenerate' ? <StatusBanner message="No usable pass for this ticket is stored on this device. Regeneration revokes the previous pass and uses another generation." title="Pass recovery" tone="warning" /> : null}
      {error ? <StatusBanner message={error} title="Could not prepare enrollment" tone="warning" /> : null}

      <View style={styles.actions}>
        {!isCloudE2E ? createPassButton : null}
        {action === 'show-pass' ? (
          <>
            <PrimaryButton label="Show secure pass" onPress={() => router.push('/pass')} />
            {allowance.remaining > 0 ? (
              <PrimaryButton
                label="Regenerate pass"
                onPress={() => Alert.alert(
                  'Regenerate pass?',
                  'The current pass will be revoked when the replacement is issued. This uses one of the remaining generations.',
                  [
                    { style: 'cancel', text: 'Cancel' },
                    { onPress: () => void startEnrollment('regeneration'), style: 'destructive', text: 'Regenerate' },
                  ],
                )}
                tone="ghost"
              />
            ) : null}
          </>
        ) : null}
        {action === 'regenerate' ? (
          <PrimaryButton disabled={isLoading} label={isLoading ? 'Preparing...' : 'Regenerate on this device'} onPress={() => void startEnrollment('regeneration')} />
        ) : null}
        {action === 'generation-limit' ? (
          <PrimaryButton disabled label="Generation limit reached" onPress={() => {}} />
        ) : null}
        {confirmation ? (
          <PrimaryButton label="View approval receipt" onPress={() => router.push(APPROVED_ROUTE)} />
        ) : null}
      </View>
    </ScreenShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
  allowanceFill: { backgroundColor: palette.success, borderRadius: 9999, height: '100%' },
  allowanceTrack: { backgroundColor: palette.fog, borderRadius: 9999, height: 8, overflow: 'hidden' },
  body: { ...typography.body, color: palette.ink, fontSize: 15, lineHeight: 23 },
  claimCode: { ...typography.title, color: palette.ink, fontSize: 20, letterSpacing: 1.2, textAlign: 'center' },
  detail: { gap: 4 },
  detailLabel: { ...typography.bodyStrong, color: palette.mutedStone, fontSize: 13 },
  detailValue: { ...typography.title, color: palette.ink, fontSize: 17 },
  eventHeader: { backgroundColor: palette.surfaceClay, borderRadius: radii.credential, gap: 6, padding: 22 },
  eventMeta: { ...typography.body, color: palette.mutedStone, fontSize: 15 },
  eventName: { ...typography.display, color: palette.ink, fontSize: 32, letterSpacing: -0.5, lineHeight: 37 },
  mutedBody: { ...typography.body, color: palette.mutedStone, fontSize: 13, lineHeight: 19 },
  screen: { gap: 18 },
});
