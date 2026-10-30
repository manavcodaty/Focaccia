'use client';

import Link from 'next/link';
import { ChevronRightIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ticketApi } from '@/lib/api';
import { formatEventDay, formatEventTimeRange } from '@/lib/presentation';
import type { OwnedTicket } from '@/lib/types';

import { useAuth } from './auth-provider';
import { EmptyTickets, InlineError, LoadingEvents } from './feedback';
import { EventPoster } from './event-poster';
import { Page, SectionHeading } from './page';
import { RevealItem, RevealList } from './reveal-list';
import { StatusText } from './status-text';

function TicketRow({ ticket }: { ticket: OwnedTicket }) {
  const name = ticket.event?.name ?? 'Event ticket';
  return (
    <Item asChild className="group/ticket transition-colors hover:bg-muted/50" variant="outline">
      <Link aria-label={`Open ticket for ${name}`} href={`/tickets/${ticket.id}`}>
        <ItemMedia className="size-14" variant="image">
          <EventPoster event={{ event_id: ticket.event_id, name }} />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="text-base">{name}<StatusText status={ticket.status} /></ItemTitle>
          <ItemDescription className="truncate tabular-nums">
            {ticket.event ? `${formatEventDay(ticket.event.starts_at)} · ${formatEventTimeRange(ticket.event.starts_at, ticket.event.ends_at)}` : '—'}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="hidden sm:flex">
          <span className="font-mono text-sm tracking-wider text-muted-foreground">{ticket.claim_code || `•••• ${ticket.claim_code_hint}`}</span>
        </ItemActions>
        <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover/ticket:translate-x-0.5" />
      </Link>
    </Item>
  );
}

export function MyTicketsPage() {
  const { loading: authLoading, session, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<OwnedTicket[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setTickets((await ticketApi.listMyTickets(session.access_token)).tickets);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to load your tickets.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/tickets');
    if (session) void load();
  }, [authLoading, load, router, session, user]);

  const active = tickets.filter((ticket) => ticket.status === 'claimed' || ticket.status === 'enrolled');
  const closed = tickets.filter((ticket) => !active.includes(ticket));

  return (
    <Page title="My tickets">
      {authLoading || loading ? <LoadingEvents label="Loading tickets" /> : error ? <InlineError message={error} retry={() => void load()} /> : tickets.length === 0 ? <EmptyTickets /> : (
        <div className="flex flex-col gap-8">
          {[{ id: 'active', items: active, title: 'Active' }, { id: 'closed', items: closed, title: 'Past' }].filter((group) => group.items.length > 0).map((group) => (
            <section aria-labelledby={`tickets-${group.id}`} className="flex flex-col gap-3" key={group.id}>
              <SectionHeading id={`tickets-${group.id}`}>{group.title}</SectionHeading>
              <RevealList className="flex flex-col gap-3">
                {group.items.map((ticket) => (
                  <RevealItem key={ticket.id}><TicketRow ticket={ticket} /></RevealItem>
                ))}
              </RevealList>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
