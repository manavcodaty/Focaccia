import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { checkedInConfirmation } from '../src/lib/ticket-state';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, radii, typography } from '../src/theme';

function formatProcessedAt(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Recorded by the gate';
}

export default function ApprovedScreen() {
  const router = useRouter();
  const { state } = useEnrollment();
  const ticket = state.selectedTicket;
  const confirmation = ticket ? checkedInConfirmation(ticket) : null;

  if (!ticket || !confirmation) {
    return (
      <ScreenShell style={styles.screen}>
        <SectionCard title="No approved ticket selected">
          <Text style={styles.body}>Return to My tickets and refresh after the gate has synchronized its decision.</Text>
          <PrimaryButton label="Back to My tickets" onPress={() => router.replace('/tickets')} />
        </SectionCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.screen}>
      <View
        accessibilityLabel={`${confirmation.title}. ${confirmation.body}`}
        accessibilityRole="summary"
        style={styles.receipt}
      >
        <View style={styles.markOuter}>
          <View style={styles.markInner}>
            <View accessibilityElementsHidden importantForAccessibility="no" style={styles.checkMark}>
              <View style={styles.checkStem} />
              <View style={styles.checkArm} />
            </View>
          </View>
        </View>
        <Text style={styles.kicker}>Gate verification complete</Text>
        <Text style={styles.title}>{confirmation.title}</Text>
        <Text style={styles.body}>{confirmation.body}</Text>
      </View>

      <SectionCard title="Approved entry">
        <Detail label="Event" value={ticket.event.name} />
        <Detail label="Ticket type" value={ticket.ticket_type.name} />
        <Detail label="Processed" value={formatProcessedAt(confirmation.processedAt)} />
        <Detail label="Location" value={ticket.event.location || 'Location to be confirmed'} />
      </SectionCard>

      <StatusBanner
        message="This ticket is closed. The gate decision has been recorded and the reusable pass is no longer shown."
        title="Checked in"
        tone="success"
      />

      <View style={styles.actions}>
        <PrimaryButton label="Back to My tickets" onPress={() => router.replace('/tickets')} />
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
  body: { ...typography.body, color: palette.mutedStone, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  checkArm: {
    backgroundColor: palette.canvas,
    borderRadius: 9999,
    height: 5,
    left: 15,
    position: 'absolute',
    top: 22,
    transform: [{ rotate: '-45deg' }],
    width: 30,
  },
  checkMark: {
    height: 44,
    position: 'relative',
    width: 44,
  },
  checkStem: {
    backgroundColor: palette.canvas,
    borderRadius: 9999,
    height: 5,
    left: 6,
    position: 'absolute',
    top: 26,
    transform: [{ rotate: '45deg' }],
    width: 17,
  },
  detail: { gap: 4 },
  detailLabel: { ...typography.bodyStrong, color: palette.mutedStone, fontSize: 13 },
  detailValue: { ...typography.title, color: palette.ink, fontSize: 17, lineHeight: 22 },
  kicker: { ...typography.bodyStrong, color: palette.terracotta, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
  markInner: {
    alignItems: 'center',
    backgroundColor: palette.success,
    borderRadius: 9999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  markOuter: {
    alignItems: 'center',
    backgroundColor: palette.successSoft,
    borderColor: palette.successBorder,
    borderRadius: 9999,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  receipt: {
    alignItems: 'center',
    backgroundColor: palette.canvas,
    borderColor: palette.successBorder,
    borderRadius: radii.credential,
    borderWidth: 1,
    boxShadow: '0px 12px 28px rgba(29, 25, 23, 0.08)',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 30,
  },
  screen: { gap: 18 },
  title: { ...typography.display, color: palette.ink, fontSize: 32, lineHeight: 37, textAlign: 'center' },
});
