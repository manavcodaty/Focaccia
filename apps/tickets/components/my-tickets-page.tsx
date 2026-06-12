'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ticketApi } from '@/lib/api';
import { formatEventDate, statusCopy } from '@/lib/presentation';
import type { OwnedTicket } from '@/lib/types';

import { useAuth } from './auth-provider';
import { EmptyTickets, InlineError, LoadingEvents } from './feedback';
import { ArrowIcon } from './icons';
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
      <div className="account-heading fade-section"><div><p className="overline">Attendee account</p><h1 className="display-heading">My tickets</h1></div><p>Every ticket is tied to {user?.email}. Sign in with the same account on another device to recover it.</p></div>
      {loading ? <LoadingEvents /> : error ? <InlineError message={error} retry={() => void load()} /> : tickets.length === 0 ? <EmptyTickets /> : (
        <div className="owned-ticket-list">
          {tickets.map((ticket, index) => {
            const state = statusCopy(ticket.status);
            return (
              <article className="owned-ticket fade-section" key={ticket.id} style={{ animationDelay: `${index * 55}ms` }}>
                <div><StatusPill status={ticket.status} /><h2>{ticket.event?.name ?? 'Event ticket'}</h2><p>{ticket.ticket_type?.name ?? 'Admission'}</p></div>
                <div className="owned-ticket-meta"><span>{ticket.event ? formatEventDate(ticket.event.starts_at, ticket.event.ends_at) : 'Date unavailable'}</span><span>{ticket.event?.location || 'Location unavailable'}</span></div>
                <div className="owned-ticket-recovery"><small>Claim code</small><strong>{ticket.claim_code}</strong><span><b>Next step:</b> {state.nextStep}</span></div>
                <Link aria-label={`Open ticket for ${ticket.event?.name ?? 'event'}`} className="round-link" href={`/tickets/${ticket.id}`}><ArrowIcon /></Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
