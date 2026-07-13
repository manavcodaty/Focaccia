import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ticketStatusPresentation,
  type EnrollmentTicket,
} from '../lib/ticket-state';
import { palette, radii, typography } from '../theme';

export const TicketRow = memo(function TicketRow({
  offline = false,
  onPress,
  ticket,
}: {
  offline?: boolean;
  onPress(): void;
  ticket: EnrollmentTicket;
}) {
  const status = ticketStatusPresentation(ticket.status);
  const startsAt = new Date(ticket.event.starts_at);

  return (
    <Pressable
      accessibilityHint="Opens ticket details"
      accessibilityLabel={`${ticket.event.name}, ${status.label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.dateBlock}>
        <Text style={styles.month}>{startsAt.toLocaleDateString(undefined, { month: 'short' })}</Text>
        <Text style={styles.day}>{startsAt.toLocaleDateString(undefined, { day: '2-digit' })}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.headingRow}>
          <Text numberOfLines={2} style={styles.eventName}>{ticket.event.name}</Text>
          <View style={[
            styles.status,
            status.tone === 'success'
              ? styles.statusSuccess
              : status.tone === 'danger'
                ? styles.statusDanger
                : status.tone === 'warning'
                  ? styles.statusWarning
                  : styles.statusNeutral,
          ]}>
            <Text style={[
              styles.statusText,
              status.tone === 'success'
                ? styles.statusTextSuccess
                : status.tone === 'danger'
                  ? styles.statusTextDanger
                  : status.tone === 'warning'
                    ? styles.statusTextWarning
                    : null,
            ]}>{status.label}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.meta}>{ticket.event.location || 'Location to be confirmed'}</Text>
        <Text style={styles.meta}>{ticket.ticket_type.name}</Text>
        <Text style={styles.claimCode}>
          {offline ? 'Saved pass available offline' : `Claim code ${ticket.claim_code}`}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  claimCode: { ...typography.bodyStrong, color: palette.terracotta, fontSize: 12, marginTop: 4 },
  content: { flex: 1, gap: 4 },
  dateBlock: {
    alignItems: 'center',
    backgroundColor: palette.warmMist,
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: 64,
    width: 58,
  },
  day: { ...typography.display, color: palette.ink, fontSize: 26, lineHeight: 29 },
  eventName: { ...typography.title, color: palette.ink, flex: 1, fontSize: 17, lineHeight: 21 },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  meta: { ...typography.body, color: palette.mutedStone, fontSize: 13 },
  month: { ...typography.bodyStrong, color: palette.terracotta, fontSize: 11, textTransform: 'uppercase' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  row: {
    backgroundColor: palette.canvas,
    borderColor: palette.border,
    borderRadius: radii.panel,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 128,
    padding: 14,
  },
  status: { borderRadius: radii.status, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  statusDanger: { backgroundColor: palette.dangerSoft, borderColor: palette.dangerBorder },
  statusNeutral: { backgroundColor: palette.neutralSoft, borderColor: palette.neutralBorder },
  statusSuccess: { backgroundColor: palette.successSoft, borderColor: palette.successBorder },
  statusText: { ...typography.bodyStrong, color: palette.ink, fontSize: 11 },
  statusTextDanger: { color: palette.danger },
  statusTextSuccess: { color: palette.success },
  statusTextWarning: { color: palette.warning },
  statusWarning: { backgroundColor: palette.warningSoft, borderColor: palette.warningBorder },
});
