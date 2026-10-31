import { ChevronRightIcon } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';

import { StatusText } from '@/components/status-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { eventDateTile, formatEventTimeRange } from '@/lib/event-format';
import { ticketStatusPresentation, type EnrollmentTicket } from '@/lib/ticket-state';

export const TicketRow = memo(function TicketRow({
  onPress,
  ticket,
}: {
  onPress(): void;
  ticket: EnrollmentTicket;
}) {
  const status = ticketStatusPresentation(ticket.status);
  const tile = eventDateTile(ticket.event.starts_at);

  return (
    <Button
      accessibilityLabel={`${ticket.event.name}, ${status.label}`}
      className="h-auto justify-start gap-3 p-3"
      onPress={onPress}
      variant="outline"
    >
      <View className="bg-muted h-14 w-14 items-center justify-center rounded-md">
        <Text className="text-muted-foreground text-xs font-normal">{tile.month}</Text>
        <Text className="text-xl font-semibold leading-6">{tile.day}</Text>
      </View>
      <View className="flex-1 gap-1">
        <Text numberOfLines={1}>{ticket.event.name}</Text>
        <View className="flex-row items-center gap-2">
          <StatusText className="font-normal" status={ticket.status} />
          <Text className="text-muted-foreground text-sm font-normal">
            {formatEventTimeRange(ticket.event.starts_at, ticket.event.ends_at)}
          </Text>
        </View>
      </View>
      <Icon as={ChevronRightIcon} className="text-muted-foreground" size={16} />
    </Button>
  );
});
