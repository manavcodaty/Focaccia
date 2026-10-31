import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { View } from 'react-native';

import { InlineAlert } from '@/components/inline-alert';
import { ScreenShell } from '@/components/screen-shell';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useGate } from '@/state/gate-context';

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
      setFeedback('Copied');
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
      } else {
        setFeedback(`Saved to ${file.uri}`);
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Failed to export logs.');
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <ScreenShell>
      <Text variant="h1">Export logs</Text>
      {feedback ? <InlineAlert message={feedback} tone="default" /> : null}
      {error ? <InlineAlert message={error} /> : null}
      <View className="gap-3">
        <Button disabled={isWorking} onPress={() => void handleShare()}>
          <Text>Share CSV</Text>
        </Button>
        <Button disabled={isWorking} onPress={() => void handleCopy()} variant="outline">
          <Text>Copy CSV</Text>
        </Button>
      </View>
    </ScreenShell>
  );
}
