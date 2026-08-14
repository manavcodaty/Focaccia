'use client';

import { useCallback, useEffect, useState } from 'react';

import { ticketApi } from '@/lib/api';
import type { PublicEvent } from '@/lib/types';

import { EventCard } from './event-card';
import { EmptyEvents, InlineError, LoadingEvents } from './feedback';
import { InspectionTicket } from './inspection-ticket';
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
    <main className="inspection-page" id="main-content">
      <section className="browse-intro page-shell">
        <div className="browse-heading fade-section">
          <p className="ledger-caption">PUBLIC EVENT LEDGER · PRIVATE ENROLLMENT</p>
          <h1>A ticket can prove entry<br />without collecting your face.</h1>
          <p>Claim a place on the web. Complete the biometric binding on your iPhone. Only the signed pass and its public key reach the gate.</p>
          <div className="trust-register" aria-label="Privacy properties">
            <span>No server face template</span>
            <span>Ed25519 signed pass</span>
            <span>Offline gate decision</span>
          </div>
        </div>
        {loading ? <div className="hero-ticket-skeleton"><span /><span /><span /></div> : events[0] ? <InspectionTicket event={events[0]} /> : null}
      </section>
      <section className="events-section page-shell" aria-labelledby="events-heading">
        <div className="ledger-heading fade-section">
          <div><h2 id="events-heading">Upcoming inspections</h2><p>Only events deliberately listed by their organizer appear here.</p></div>
          <div className="ledger-heading-meta"><NetworkLabel /><span>{loading ? 'Reading ledger' : `${events.length} listed`}</span></div>
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
