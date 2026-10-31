import { useRouter } from 'expo-router';
import { CircleCheckIcon, TicketXIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ScreenShell } from '@/components/screen-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { checkedInConfirmation } from '@/lib/ticket-state';
import { useEnrollment } from '@/state/enrollment-context';

export default function ApprovedScreen() {
  const router = useRouter();
  const { state } = useEnrollment();
  const ticket = state.selectedTicket;
  const confirmation = ticket ? checkedInConfirmation(ticket) : null;

  if (!ticket || !confirmation) {
    return (
      <ScreenShell>
        <EmptyState icon={TicketXIcon} title="No check-in">
          <Button onPress={() => router.replace('/tickets')}><Text>My tickets</Text></Button>
        </EmptyState>
      </ScreenShell>
    );
  }

  const processedAt = confirmation.processedAt ? new Date(confirmation.processedAt).toLocaleString() : null;

  return (
    <ScreenShell>
      <View accessibilityLabel={`Checked in. ${ticket.event.name}`} accessibilityRole="summary" className="flex-row items-center gap-3">
        <Icon as={CircleCheckIcon} className="text-success" size={28} />
        <Text className="flex-1" variant="h1">Checked in</Text>
      </View>

      <Card className="gap-0 py-0">
        <CardContent className="gap-1 py-3">
          <Text className="font-medium">{ticket.event.name}</Text>
          <Text className="text-muted-foreground text-sm">{ticket.ticket_type.name}</Text>
        </CardContent>
        {processedAt ? (
          <>
            <Separator />
            <CardContent className="flex-row items-center justify-between gap-4 py-3">
              <Text className="text-muted-foreground shrink text-sm">Entry</Text>
              <Text className="shrink text-right text-sm">{processedAt}</Text>
            </CardContent>
          </>
        ) : null}
      </Card>

      <Button onPress={() => router.replace('/tickets')}><Text>Done</Text></Button>
    </ScreenShell>
  );
}
