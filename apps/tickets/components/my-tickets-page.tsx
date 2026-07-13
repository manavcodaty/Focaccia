'use client';

import Link from 'next/link';
import { ArrowUpRight, CalendarDays, MapPin, Ticket } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ticketApi } from '@/lib/api';
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
    <main className="page-shell account-page" id="main-content">
      <div className="account-heading fade-section"><div><p className="overline">Attendee wallet</p><h1 className="display-heading">My tickets</h1></div><p>Every ticket is tied to <strong>{user?.email}</strong>. Sign in with the same account on another device to recover it.</p></div>
      {loading ? <LoadingEvents /> : error ? <InlineError message={error} retry={() => void load()} /> : tickets.length === 0 ? <EmptyTickets /> : (
        <RevealList className="owned-ticket-list">
          {tickets.map((ticket, index) => {
            const state = statusCopy(ticket.status);
            return (
              <RevealItem key={ticket.id}>
                <article className="owned-ticket fade-section" style={{ animationDelay: `${index * 45}ms` }}>
                  <div className="owned-ticket-identity"><div className="owned-ticket-mark" aria-hidden="true"><Ticket /></div><div><StatusPill status={ticket.status} /><h2>{ticket.event?.name ?? 'Event ticket'}</h2><p>{ticket.ticket_type?.name ?? 'Admission'}</p></div></div>
                  <div className="owned-ticket-meta"><span><CalendarDays />{ticket.event ? formatEventDate(ticket.event.starts_at, ticket.event.ends_at) : 'Date unavailable'}</span><span><MapPin />{ticket.event?.location || 'Location unavailable'}</span></div>
                  <div className="owned-ticket-recovery"><small>{ticket.claim_code ? 'Claim code' : 'Claim code unavailable'}</small><strong>{ticket.claim_code || `Ends ${ticket.claim_code_hint}`}</strong><span><b>Next step:</b> {ticket.claim_code ? state.nextStep : 'Open this ticket for recovery options.'}</span></div>
                  <Button asChild size="sm" variant="outline"><Link aria-label={`Open ticket for ${ticket.event?.name ?? 'event'}`} href={`/tickets/${ticket.id}`}>Open ticket<ArrowUpRight data-icon="inline-end" /></Link></Button>
                </article>
              </RevealItem>
            );
          })}
        </RevealList>
      )}
    </main>
  );
}
