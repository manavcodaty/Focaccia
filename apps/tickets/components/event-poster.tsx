import type { CSSProperties } from 'react';

import { createEventPoster } from '@/lib/event-poster';
import type { PublicEvent } from '@/lib/types';

export function EventPoster({ event, size = 'card' }: { event: PublicEvent; size?: 'card' | 'hero' }) {
  const poster = createEventPoster(event.event_id, event.name);
  const style = {
    '--poster-accent': poster.accent,
    '--poster-background': poster.background,
    '--poster-foreground': poster.foreground,
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className={`event-poster event-poster-${size} event-poster-${poster.motif}`}
      data-event-id={event.event_id}
      style={style}
    >
      <span className="event-poster-kicker">Focaccia · {poster.serial}</span>
      <strong>{poster.initials}</strong>
      <span className="event-poster-line" />
    </div>
  );
}
