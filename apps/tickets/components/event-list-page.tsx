'use client';

import { useCallback, useEffect, useState } from 'react';

import { ticketApi } from '@/lib/api';
import type { PublicEvent } from '@/lib/types';

import { EventCard } from './event-card';
import { EmptyEvents, InlineError, LoadingEvents } from './feedback';
import { NetworkLabel } from './network-label';
import { RevealItem, RevealList } from './reveal-list';

export function EventListPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ticketApi.getEvents();
      setEvents(result.events);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main id="main-content">
      <section className="listing-intro">
        <div className="page-shell catalogue-heading fade-section">
          <NetworkLabel />
          <p className="overline">Public programme</p>
          <h1 className="display-heading">Choose somewhere worth showing up for.</h1>
          <p>Browse real listed events, claim a free ticket, then enroll privately on your iPhone.</p>
        </div>
      </section>
      <section className="events-section page-shell" aria-labelledby="events-heading">
        <div className="section-heading fade-section">
          <div><h2 id="events-heading">Upcoming events</h2></div>
          <p>Only events deliberately listed by their organizer appear here.</p>
        </div>
        {loading ? <LoadingEvents /> : error ? <InlineError message={error} retry={() => void load()} /> : events.length > 0 ? (
          <RevealList className="event-grid">
            {events.map((event, index) => (
              <RevealItem key={event.event_id}>
                <EventCard event={event} index={index} />
              </RevealItem>
            ))}
          </RevealList>
        ) : (
          <EmptyEvents />
        )}
      </section>
    </main>
  );
}
