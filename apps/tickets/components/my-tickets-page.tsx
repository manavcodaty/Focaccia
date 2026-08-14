'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ticketApi } from '@/lib/api';
import { createEventPoster } from '@/lib/event-poster';
import { formatEventDate, statusCopy } from '@/lib/presentation';
import type { OwnedTicket } from '@/lib/types';

import { useAuth } from './auth-provider';
import { EmptyTickets, InlineError, LoadingEvents } from './feedback';
import { RevealItem, RevealList } from './reveal-list';
import { StatusPill } from './status-pill';

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

  if (authLoading || (!user && loading)) return <main className="page-shell account-loading" id="main-content"><LoadingEvents /></main>;

  return (
    <main className="page-shell account-page inspection-page" id="main-content">
      <div className="account-heading fade-section"><div><p className="ledger-caption">ARCHIVAL PASS LEDGER</p><h1>My ticket folios</h1><p>Every record is tied to <strong>{user?.email}</strong>.</p></div><span>{tickets.length} total folios</span></div>
      {loading ? <LoadingEvents /> : error ? <InlineError message={error} retry={() => void load()} /> : tickets.length === 0 ? <EmptyTickets /> : (
        <RevealList className="owned-ticket-list ticket-ledger">
          <div aria-hidden="true" className="ticket-ledger-columns"><span>Folio</span><span>Event</span><span>Date and venue</span><span>State</span><span>Record</span></div>
          {tickets.map((ticket, index) => {
            const state = statusCopy(ticket.status);
            const poster = createEventPoster(ticket.event_id, ticket.event?.name ?? 'Event ticket');
            return (
              <RevealItem key={ticket.id}>
                <article className="owned-ticket fade-section" style={{ animationDelay: `${index * 45}ms` }}>
                  <div className="owned-ticket-folio" aria-hidden="true"><strong>{poster.serial}</strong><span>{String(index + 1).padStart(2, '0')}</span></div>
                  <div className="owned-ticket-identity"><div><p>{ticket.ticket_type?.name ?? 'Admission'}</p><h2>{ticket.event?.name ?? 'Event ticket'}</h2><small>{ticket.claim_code ? `Claim code ${ticket.claim_code}` : `Claim code ends ${ticket.claim_code_hint}`}</small></div></div>
                  <div className="owned-ticket-meta"><span>{ticket.event ? formatEventDate(ticket.event.starts_at, ticket.event.ends_at) : 'Date unavailable'}</span><span>{ticket.event?.location || 'Location unavailable'}</span></div>
                  <div className="owned-ticket-state"><StatusPill status={ticket.status} /><small>{state.nextStep}</small></div>
                  <Button asChild size="sm" variant="outline"><Link aria-label={`Open ticket for ${ticket.event?.name ?? 'event'}`} href={`/tickets/${ticket.id}`}>Open ticket<ArrowUpRight data-icon="inline-end" /></Link></Button>
                </article>
              </RevealItem>
            );
          })}
          <div className="ticket-ledger-summary">
            <div><strong>{tickets.filter((ticket) => ticket.status === 'claimed').length}</strong><span>Awaiting enrollment</span></div>
            <div><strong>{tickets.filter((ticket) => ticket.status === 'enrolled').length}</strong><span>Pass ready</span></div>
            <div><strong>{tickets.filter((ticket) => ['cancelled', 'revoked'].includes(ticket.status)).length}</strong><span>Inactive records</span></div>
          </div>
        </RevealList>
      )}
    </main>
  );
}
