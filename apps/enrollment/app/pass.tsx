import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { enrollmentApi } from '../src/lib/api';
import { useEnrollment } from '../src/state/enrollment-context';
import { palette, radii, typography } from '../src/theme';

const PASS_TOKEN_CLIPBOARD_TTL_MS = 60_000;
const isCloudE2E = process.env.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1';

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
  const { setBundle, state } = useEnrollment();
  const [message, setMessage] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const pass = state.pass;
  const ticket = state.selectedTicket;

  if (!pass) {
    return (
      <ScreenShell style={styles.screen}>
        <SectionCard title="No secure pass is stored">
          <Text style={styles.body}>Open the ticket and enroll or regenerate on this device.</Text>
          <PrimaryButton label="Back to My tickets" onPress={() => router.replace('/tickets')} />
        </SectionCard>
      </ScreenShell>
    );
  }

  const remaining = Math.max(0, 3 - pass.generation);

  async function prepareRegeneration() {
    if (!ticket) return;
    setIsPreparing(true);
    setMessage(null);
    try {
      const bundle = await enrollmentApi.getEnrollmentBundle({ ticketId: ticket.id });
      setBundle(bundle, 'regeneration');
      router.push('/consent');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to prepare regeneration.');
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <ScreenShell style={styles.screen}>
      <View style={styles.readyHeader}>
        <Text style={styles.readyLabel}>Pass ready</Text>
        <Text style={styles.eventName}>{pass.event.name}</Text>
        <Text style={styles.eventMeta}>{pass.event.location || 'Location to be confirmed'}</Text>
        <Text style={styles.eventMeta}>{new Date(pass.event.starts_at).toLocaleString()}</Text>
      </View>

      <SectionCard eyebrow="Event pass" title={pass.ticketTypeName} tone="credential">
        <Text style={styles.generation}>Generation {pass.generation} of 3</Text>
        <View style={styles.qrWrap}>
          <QRCode backgroundColor={palette.canvas} color={palette.ink} quietZone={16} size={260} value={pass.token} />
        </View>
        {pass.queueCode ? <Text style={styles.queueCode}>{pass.queueCode}</Text> : null}
        <Text style={styles.validUntil}>Valid until {new Date(pass.event.ends_at).toLocaleString()}</Text>
      </SectionCard>

      <StatusBanner message="This signed pass is stored in iOS protected storage on this device." title="Offline ready" tone="success" />

      <SectionCard eyebrow="Scanner recovery" title="Manual fallback" tone="subtle">
        <Text style={styles.body}>If QR scanning fails, gate staff can paste the full signed token into the same offline verification pipeline.</Text>
        <Text style={styles.snippet}>{pass.tokenSnippet}</Text>
        <PrimaryButton
          label="Copy full signed token"
          onPress={() => {
            void copyPassTokenToClipboard(pass.token, () => setMessage('Full signed token copied briefly.'));
          }}
          tone="ghost"
        />
      </SectionCard>

      {message ? <StatusBanner message={message} tone={message.includes('copied') ? 'success' : 'warning'} /> : null}
      {isCloudE2E && message?.includes('copied') ? (
        <Text accessibilityLabel={`Cloud E2E signed token ${pass.token}`} style={styles.cloudE2ETokenBridge}>
          Cloud E2E token bridge ready
        </Text>
      ) : null}

      <View style={styles.actions}>
        {ticket && remaining > 0 ? (
          <PrimaryButton
            disabled={isPreparing}
            label={isPreparing ? 'Preparing...' : 'Regenerate pass'}
            onPress={() => Alert.alert(
              'Regenerate pass?',
              `The current pass will be revoked after the replacement is issued. ${remaining} ${remaining === 1 ? 'generation remains' : 'generations remain'}.`,
              [
                { style: 'cancel', text: 'Cancel' },
                { onPress: () => void prepareRegeneration(), style: 'destructive', text: 'Regenerate' },
              ],
            )}
            tone="ghost"
          />
        ) : null}
        {remaining === 0 ? <StatusBanner message="Generation limit reached. The organizer must reset the ticket before another pass can be issued." tone="warning" /> : null}
        <PrimaryButton label="Back to My tickets" onPress={() => router.replace('/tickets')} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
  body: { ...typography.body, color: palette.ink, fontSize: 15, lineHeight: 23 },
  cloudE2ETokenBridge: { ...typography.body, color: palette.mutedStone, fontSize: 12, textAlign: 'center' },
  eventMeta: { ...typography.body, color: palette.mutedStone, fontSize: 14 },
  eventName: { ...typography.display, color: palette.ink, fontSize: 30, lineHeight: 35, textAlign: 'center' },
  generation: { ...typography.bodyStrong, color: palette.terracotta, fontSize: 15, textAlign: 'center' },
  qrWrap: { alignItems: 'center', backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radii.panel, borderWidth: 1, padding: 10 },
  queueCode: { ...typography.title, color: palette.ink, fontSize: 20, letterSpacing: 2, textAlign: 'center' },
  readyHeader: { alignItems: 'center', backgroundColor: palette.surfaceClay, borderRadius: radii.credential, gap: 6, padding: 24 },
  readyLabel: { ...typography.bodyStrong, color: palette.success, fontSize: 14 },
  screen: { gap: 18 },
  snippet: { ...typography.bodyStrong, color: palette.terracotta, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  validUntil: { ...typography.body, color: palette.mutedStone, fontSize: 13, textAlign: 'center' },
});
