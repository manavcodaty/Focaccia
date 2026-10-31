import { CalendarIcon, MapPinIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatEventWhen } from '@/lib/event-format';
import type { EnrollmentTicket } from '@/lib/ticket-state';

/** Date and place, one icon line each — the web ticket detail pattern. */
export function EventMeta({ event }: { event: EnrollmentTicket['event'] }) {
  const when = formatEventWhen(event.starts_at, event.ends_at);

  return (
    <View className="gap-2">
      {when ? (
        <View className="flex-row items-start gap-2">
          <Icon as={CalendarIcon} className="text-muted-foreground mt-0.5" size={16} />
          <Text className="flex-1 text-sm leading-5">{when}</Text>
        </View>
      ) : null}
      {event.location ? (
        <View className="flex-row items-start gap-2">
          <Icon as={MapPinIcon} className="text-muted-foreground mt-0.5" size={16} />
          <Text className="flex-1 text-sm leading-5">{event.location}</Text>
        </View>
      ) : null}
    </View>
  );
}
