import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { generationAllowance } from '../src/lib/ticket-state';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, typography } from '../src/theme';

export default function ConsentScreen() {
  const router = useRouter();
  const { acceptConsent, state } = useEnrollment();
  const ticket = state.selectedTicket;
  const bundle = state.bundle;

  if (!ticket || !bundle) {
    return (
      <ScreenShell style={styles.screen}>
        <SectionCard title="Select a ticket first">
          <Text style={styles.body}>Select your ticket in My tickets.</Text>
          <PrimaryButton label="Back to My tickets" onPress={() => router.replace('/tickets')} />
        </SectionCard>
      </ScreenShell>
    );
  }

  const allowance = generationAllowance(ticket.generation_count);

  return (
    <ScreenShell style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {state.intent === 'regeneration' ? 'Replace your event pass' : 'Create your event pass'}
        </Text>
        <Text style={styles.subtitle}>{ticket.event.name}</Text>
      </View>

      <SectionCard eyebrow="On-device processing" title="On your iPhone" tone="subtle">
        <Text style={styles.body}>One face capture is processed locally into an event template.</Text>
        <Text style={styles.body}>Temporary captures are deleted best-effort after processing. Face images, embeddings, and unencrypted templates are not saved to your account.</Text>
      </SectionCard>

      <SectionCard eyebrow="Signing boundary" title="What the server receives">
        <Text style={styles.body}>Your ticket ID and gate-encrypted event template, for pass signing.</Text>
        <Text style={styles.body}>No face image, reusable embedding, decrypted template, or password is sent. The final signed token is not stored on the server.</Text>
      </SectionCard>

      <SectionCard title="Ticket and generation">
        <Detail label="Ticket" value={ticket.ticket_type.name} />
        <Detail label="Claim code" value={ticket.claim_code} />
        <Detail label="Generation used" value={`${allowance.used} of 3`} />
        <Detail label="Remaining after this pass" value={String(Math.max(0, allowance.remaining - 1))} />
        {state.intent === 'regeneration' ? (
          <Text style={styles.warning}>The old pass is revoked when its replacement is issued.</Text>
        ) : null}
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          label="I consent and continue"
          onPress={() => {
            acceptConsent();
            router.push('/capture');
          }}
        />
        <PrimaryButton label="Back" onPress={() => router.back()} tone="ghost" />
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
  body: { ...typography.body, color: palette.ink, fontSize: 15, lineHeight: 23 },
  detail: { gap: 4 },
  detailLabel: { ...typography.bodyStrong, color: palette.mutedStone, fontSize: 13 },
  detailValue: { ...typography.title, color: palette.ink, fontSize: 16 },
  header: { gap: 6, paddingTop: 8 },
  screen: { gap: 18 },
  subtitle: { ...typography.body, color: palette.mutedStone, fontSize: 16 },
  title: { ...typography.display, color: palette.ink, fontSize: 30, lineHeight: 36 },
  warning: { ...typography.bodyStrong, color: palette.warning, fontSize: 13, lineHeight: 19 },
});
