import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../src/components/primary-button';
import { ScreenShell } from '../src/components/screen-shell';
import { SectionCard } from '../src/components/section-card';
import { StatusBanner } from '../src/components/status-banner';
import { useGate } from '../src/state/gate-context';
import { palette, typography } from '../src/theme';

export default function ExportScreen() {
  const { exportLogsCsv, gate } = useGate();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function handleCopy() {
    setError(null);
    setFeedback(null);
    setIsWorking(true);

    try {
      const csv = await exportLogsCsv();

      await Clipboard.setStringAsync(csv);
      setFeedback('Copied the current offline gate log CSV to the clipboard.');
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Failed to copy logs.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleShare() {
    setError(null);
    setFeedback(null);
    setIsWorking(true);

    try {
      const csv = await exportLogsCsv();
      const file = new File(Paths.cache, `${gate?.event_id ?? 'face-pass'}-gate-logs.csv`);

      if (file.exists) {
        file.delete();
      }

      file.create();
      file.write(csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
        setFeedback('Shared the offline gate log CSV.');
      } else {
        setFeedback(`Sharing is unavailable on this device. CSV saved at ${file.uri}.`);
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Failed to export logs.');
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell>
      <SectionCard eyebrow="Export" title="Operational logs only">
        <Text style={styles.body}>
          CSV export contains timings, event IDs, pass references, outcomes, and reason codes. It
          never includes biometric templates or captured images.
        </Text>
        {feedback ? <StatusBanner message={feedback} tone="success" /> : null}
        {error ? <StatusBanner message={error} tone="danger" /> : null}
      </SectionCard>

      <View style={styles.actions}>
        <PrimaryButton
          disabled={isWorking}
          label={isWorking ? 'Preparing CSV...' : 'Copy CSV to clipboard'}
          onPress={() => {
            void handleCopy();
          }}
        />
        <PrimaryButton
          disabled={isWorking}
          label={isWorking ? 'Preparing CSV...' : 'Share CSV file'}
          onPress={() => {
            void handleShare();
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
  body: {
    ...typography.body,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
});
