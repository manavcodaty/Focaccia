'use client';

import { useCallback, useEffect, useState } from 'react';

import { ticketApi } from '@/lib/api';
import type { PublicEvent } from '@/lib/types';

import { EventCard } from './event-card';
import { InlineError, LoadingEvents } from './feedback';
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
        <div className="page-shell intro-grid">
          <div className="fade-section">
            <NetworkLabel />
            <h1 className="display-heading">A place worth showing up for.</h1>
            <p>Browse listed events, claim a real free ticket, then continue privately in the Focaccia enrollment app.</p>
          </div>
          <div className="programme-visual fade-section fade-delay-1" aria-hidden="true">
            <div className="programme-card programme-card-main">
              <span>Focaccia</span>
              <strong>Public programme</strong>
              <small>Free admission · private enrollment later</small>
              <div className="programme-card-dots">
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="programme-card programme-card-soft">
              <span>Claim code</span>
              <strong>7K4-29Q</strong>
            </div>
            <div className="programme-orbit programme-orbit-one" />
            <div className="programme-orbit programme-orbit-two" />
          </div>
        </div>
      </section>
      <section className="events-section page-shell" aria-labelledby="events-heading">
        <div className="section-heading fade-section fade-delay-1">
          <div><p className="overline">Public programme</p><h2 id="events-heading">Upcoming events</h2></div>
          <p>Only events deliberately listed by their organizer appear here.</p>
        </div>
        {loading ? <LoadingEvents /> : error ? <InlineError message={error} retry={() => void load()} /> : events.length > 0 ? (
          <RevealList className="event-list">
            {events.map((event, index) => (
              <RevealItem key={event.event_id}>
                <EventCard event={event} index={index} />
              </RevealItem>
            ))}
          </RevealList>
        ) : (
          <div className="empty-state compact"><h2>No listed events</h2><p>There are no upcoming public events at the moment. Check back after an organizer publishes one.</p></div>
        )}
      </section>
    </main>
  );
}
