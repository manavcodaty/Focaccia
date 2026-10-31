import { useRouter } from 'expo-router';
import { ChevronDownIcon, CircleCheckIcon, CircleXIcon, ScanLineIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { DetailList } from '@/components/detail-list';
import { EmptyState } from '@/components/empty-state';
import { ScreenShell } from '@/components/screen-shell';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/display';
import { decisionTitle } from '@/lib/gate-presentation';
import { cn } from '@/lib/utils';
import { useGate } from '@/state/gate-context';

export default function ResultScreen() {
  const router = useRouter();
  const { lastResult, resetLastResult } = useGate();
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!lastResult) {
    return (
      <ScreenShell header={false}>
        <EmptyState icon={ScanLineIcon} title="No result">
          <Button onPress={() => router.replace('/scan')}><Text>Scan</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  const title = decisionTitle(lastResult.accepted);
  const { timings } = lastResult;

  return (
    <ScreenShell header={false} variant={lastResult.accepted ? 'accepted' : 'rejected'}>
      <View
        accessibilityLabel={`${title}. ${lastResult.hint}`}
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
        className="flex-1 items-center justify-center gap-4 py-8"
      >
        <Icon
          as={lastResult.accepted ? CircleCheckIcon : CircleXIcon}
          className={lastResult.accepted ? 'text-success' : 'text-destructive'}
          size={64}
        />
        <Text className={cn('text-center text-4xl', lastResult.accepted ? 'text-success' : 'text-destructive')} variant="h1">
          {title}
        </Text>
        <Text className="text-muted-foreground text-center">{lastResult.hint}</Text>
      </View>

      <Collapsible onOpenChange={setDetailsOpen} open={detailsOpen}>
        <CollapsibleTrigger asChild>
          <Button className="self-center" size="sm" variant="ghost">
            <Text>Details</Text>
            <Icon as={ChevronDownIcon} className={cn(detailsOpen && 'rotate-180')} size={16} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <DetailList
            items={[
              { label: 'Total', value: formatDuration(timings.total_ms) },
              { label: 'Scan', value: formatDuration(timings.scan_ms) },
              { label: 'Decode', value: formatDuration(timings.decode_ms) },
              { label: 'Verify', value: formatDuration(timings.verify_ms) },
              { label: 'Decrypt', value: formatDuration(timings.decrypt_ms) },
              { label: 'Face capture', value: formatDuration(timings.liveness_ms) },
              { label: 'Match', value: formatDuration(timings.match_ms) },
              { label: 'Distance', value: lastResult.hammingDistance === null ? '—' : String(lastResult.hammingDistance) },
              { label: 'Reason', value: lastResult.reasonCode },
            ]}
          />
        </CollapsibleContent>
      </Collapsible>

      <View className="gap-3">
        <Button
          onPress={() => {
            resetLastResult();
            router.replace('/scan');
          }}
          size="lg"
        >
          <Text>Next</Text>
        </Button>
        <Button onPress={() => router.replace('/')} variant="outline">
          <Text>Home</Text>
        </Button>
      </View>
    </ScreenShell>
  );
}
