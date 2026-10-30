import type { CSSProperties } from 'react';

import { createEventPoster } from '@/lib/event-poster';
import type { PublicEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Deterministic admission-ticket artwork derived from the event's identity:
 * a tinted stub with the event's initials, notched like the brand mark.
 */
export function EventPoster({ className, event, size = 'card' }: { className?: string; event: Pick<PublicEvent, 'event_id' | 'name'>; size?: 'card' | 'hero' }) {
  const poster = createEventPoster(event.event_id, event.name);
  const style = {
    background: `color-mix(in oklch, ${poster.accent} 14%, var(--card))`,
    color: `color-mix(in oklch, ${poster.accent} 72%, var(--foreground))`,
  } as CSSProperties;

  if (size === 'card') {
    return (
      <div aria-hidden="true" className={cn('flex size-full items-center justify-center rounded-md text-base font-semibold tracking-tight', className)} data-event-id={event.event_id} style={style}>
        {poster.initials}
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={cn('relative flex aspect-square w-full items-end overflow-hidden rounded-xl p-6', className)} data-event-id={event.event_id} style={style}>
      <span className="absolute top-1/2 -left-4 size-8 -translate-y-1/2 rounded-full bg-background" />
      <span className="absolute top-1/2 -right-4 size-8 -translate-y-1/2 rounded-full bg-background" />
      <strong className="text-7xl font-semibold tracking-tighter">{poster.initials}</strong>
    </div>
  );
}
