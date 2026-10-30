import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';

import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { formatEventTimeRange, formatPrice } from '@/lib/presentation';
import type { PublicEvent } from '@/lib/types';

import { EventPoster } from './event-poster';

export function EventCard({ event }: { event: PublicEvent }) {
  const lowestPrice = event.ticket_types.reduce((lowest, type) => Math.min(lowest, type.price_pence), Infinity);
  const price = lowestPrice === Infinity ? '—' : lowestPrice === 0 ? 'Free' : formatPrice(lowestPrice);
  const time = formatEventTimeRange(event.starts_at, event.ends_at);

  return (
    <Item asChild className="group/event transition-colors hover:bg-muted/50" variant="outline">
      <Link aria-label={`${event.name}, ${time}${event.location ? `, ${event.location}` : ''}, ${event.sold_out ? 'sold out' : price}`} href={`/events/${encodeURIComponent(event.event_id)}`}>
        <ItemMedia className="size-14" variant="image">
          <EventPoster event={event} />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="text-base">{event.name}</ItemTitle>
          <ItemDescription className="truncate tabular-nums">{time}{event.location ? ` · ${event.location}` : ''}</ItemDescription>
        </ItemContent>
        <ItemActions>
          {event.sold_out ? <span className="text-sm">Sold out</span> : <span className="text-sm font-medium">{price}</span>}
        </ItemActions>
        <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover/event:translate-x-0.5" />
      </Link>
    </Item>
  );
}
