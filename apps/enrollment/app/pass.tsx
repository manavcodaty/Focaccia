import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, typography } from '../src/theme';

export default function PassScreen() {
  const router = useRouter();
  const { reset, state } = useEnrollment();
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const bundle = state.bundle;
  const pass = state.pass;

  if (!bundle || !pass) {
    return (
      <ScreenShell style={styles.screen}>
        <SectionCard eyebrow="Missing pass" title="No issued pass is available">
          <Text style={styles.bodyText}>
            Capture and issuance need to complete before a QR token can be shown here.
          </Text>
          <PrimaryButton label="Start again" onPress={() => router.replace('/')} />
        </SectionCard>
      </ScreenShell>
    );
  }

  const activeBundle = bundle!;
  const activePass = pass!;

  async function handleCopy() {
    await Clipboard.setStringAsync(activePass.token);
    setCopiedMessage('Full token copied for typed or pasted fallback.');
  }

  return (
    <ScreenShell style={styles.screen}>
      <SectionCard eyebrow="Pass ready" title="Your one-time event pass is ready">
        <Text style={styles.bodyText}>
          Present this QR code at the gate. The verifier will confirm the signature and match a live face check there.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Event" title={activeBundle.event_id}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Valid until</Text>
          <Text style={styles.detailValue}>{new Date(activeBundle.ends_at).toLocaleString()}</Text>
        </View>
        {activePass.queueCode ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Queue code</Text>
            <Text style={styles.detailValue}>{activePass.queueCode}</Text>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="QR token" title="Show this at the gate">
        <View style={styles.qrWrap}>
          <QRCode
            backgroundColor={palette.card}
            color={palette.ink}
            quietZone={18}
            size={260}
            value={activePass.token}
          />
        </View>
        <Text style={styles.snippetLabel}>Manual fallback token snippet</Text>
        <Text style={styles.snippetValue}>{activePass.tokenSnippet}</Text>
        <PrimaryButton label="Copy full token" onPress={() => void handleCopy()} />
        {copiedMessage ? <StatusBanner message={copiedMessage} tone="success" /> : null}
      </SectionCard>

      <SectionCard eyebrow="Instructions" title="If scanning fails">
        <Text style={styles.bodyText}>
          Ask gate staff to paste the full token. The short snippet helps confirm they are entering the right value, but it is not enough on its own.
        </Text>
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          label="Start a new enrollment"
          onPress={() => {
            reset();
            router.replace('/');
          }}
          tone="ghost"
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  bodyText: {
    ...typography.body,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  detailLabel: {
    ...typography.bodyStrong,
    color: palette.muted,
    fontSize: 14,
  },
  detailRow: {
    gap: 4,
  },
  detailValue: {
    ...typography.title,
    color: palette.ink,
    fontSize: 16,
  },
  qrWrap: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 28,
    padding: 18,
  },
  screen: {
    gap: 18,
  },
  snippetLabel: {
    ...typography.title,
    color: palette.muted,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  snippetValue: {
    ...typography.title,
    color: palette.ink,
    fontSize: 16,
    lineHeight: 22,
  },
});
