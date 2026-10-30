'use client';

import { SearchIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ticketApi } from '@/lib/api';
import { eventDayKey, formatEventDay } from '@/lib/presentation';
import type { PublicEvent } from '@/lib/types';

import { EventCard } from './event-card';
import { EmptyEvents, InlineError, LoadingEvents, NoMatchingEvents } from './feedback';
import { Page, SectionHeading } from './page';
import { RevealItem, RevealList } from './reveal-list';

function matches(event: PublicEvent, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [event.name, event.location, event.organizer, event.description].some((field) => field?.toLowerCase().includes(needle));
}

export function EventListPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

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

  const groups = useMemo(() => {
    const visible = events.filter((event) => matches(event, query)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const byDay = new Map<string, PublicEvent[]>();
    visible.forEach((event) => {
      const key = eventDayKey(event.starts_at);
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    });
    return [...byDay.entries()];
  }, [events, query]);

  return (
    <Page title="Events" titleId="events-heading">
      <InputGroup>
        <InputGroupAddon><SearchIcon /></InputGroupAddon>
        <InputGroupInput aria-label="Search events" onChange={(event) => setQuery(event.target.value)} placeholder="Search" type="search" value={query} />
      </InputGroup>

      <section aria-labelledby="events-heading" className="flex flex-col gap-8">
        {loading ? <LoadingEvents /> : error ? <InlineError message={error} retry={() => void load()} /> : events.length === 0 ? (
          <EmptyEvents />
        ) : groups.length === 0 ? (
          <NoMatchingEvents reset={() => setQuery('')} />
        ) : (
          groups.map(([day, items]) => (
            <div className="flex flex-col gap-3" key={day}>
              <SectionHeading>{formatEventDay(items[0].starts_at)}</SectionHeading>
              <RevealList className="flex flex-col gap-3">
                {items.map((event) => (
                  <RevealItem key={event.event_id}>
                    <EventCard event={event} />
                  </RevealItem>
                ))}
              </RevealList>
            </div>
          ))
        )}
      </section>
    </Page>
  );
}
