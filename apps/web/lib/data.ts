import "server-only";

import { notFound, redirect } from "next/navigation";

import { parseEdgeFunctionResponse } from "@/lib/edge-function-response";
import { getPublicEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  DashboardEventSummary,
  EventRecord,
  GateLogRecord,
  OrganizerEventOperations,
  RevocationRecord,
  TicketStatus,
  TicketStatusCounts,
} from "@/lib/types";

const EVENT_COLUMNS = "capacity, created_at, description, ends_at, event_id, event_salt, is_listed, join_code, location, name, pk_gate_event, pk_sign_event, starts_at, updated_at";
const EMPTY_COUNTS: TicketStatusCounts = {
  cancelled: 0,
  checked_in: 0,
  claimed: 0,
  enrolled: 0,
  revoked: 0,
};

function groupCount<T extends { event_id: string }>(rows: T[]): Map<string, number> {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    map.set(row.event_id, (map.get(row.event_id) ?? 0) + 1);
  });

  return map;
}

function groupTicketCounts(rows: Array<{ event_id: string; status: TicketStatus }>) {
  const map = new Map<string, TicketStatusCounts>();

  rows.forEach((row) => {
    const current = map.get(row.event_id) ?? { ...EMPTY_COUNTS };
    map.set(row.event_id, { ...current, [row.status]: current[row.status] + 1 });
  });

  return map;
}

export async function requireOrganizer() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: organizer } = await supabase
    .from("organizer_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizer) {
    redirect("/login?error=organizer_required");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { accessToken: session?.access_token ?? null, supabase, user };
}

export async function getDashboardData() {
  const { supabase, user } = await requireOrganizer();
  const { data: events, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const eventRows = (events ?? []) as unknown as EventRecord[];
  const eventIds = eventRows.map((event) => event.event_id);
  let revocations: RevocationRecord[] = [];
  let logs: GateLogRecord[] = [];
  let tickets: Array<{ event_id: string; status: TicketStatus }> = [];
  let gates: Array<{ event_id: string; last_seen_at: string | null }> = [];

  if (eventIds.length > 0) {
    const [revocationResult, logResult, ticketResult, gateResult] = await Promise.all([
      supabase.from("revocations").select("event_id, pass_id, revoked_at").in("event_id", eventIds),
      supabase.from("gate_logs").select("csv_url, event_id, id, uploaded_at").in("event_id", eventIds),
      supabase.from("event_tickets").select("event_id, status").in("event_id", eventIds),
      supabase.from("gate_devices").select("event_id, last_seen_at").in("event_id", eventIds),
    ]);

    const queryError = revocationResult.error ?? logResult.error ?? ticketResult.error ?? gateResult.error;
    if (queryError) throw new Error(queryError.message);
    revocations = (revocationResult.data ?? []) as RevocationRecord[];
    logs = (logResult.data ?? []) as GateLogRecord[];
    tickets = (ticketResult.data ?? []) as Array<{ event_id: string; status: TicketStatus }>;
    gates = (gateResult.data ?? []) as Array<{ event_id: string; last_seen_at: string | null }>;
  }

  const revocationCounts = groupCount(revocations);
  const logCounts = groupCount(logs);
  const ticketCounts = groupTicketCounts(tickets);
  const gateByEvent = new Map(gates.map((gate) => [gate.event_id, gate]));
  const summaries: DashboardEventSummary[] = eventRows.map((event) => ({
    ...event,
    gateLastSeenAt: gateByEvent.get(event.event_id)?.last_seen_at ?? null,
    logCount: logCounts.get(event.event_id) ?? 0,
    revocationCount: revocationCounts.get(event.event_id) ?? 0,
    ticketCounts: ticketCounts.get(event.event_id) ?? { ...EMPTY_COUNTS },
  }));

  return {
    events: summaries,
    metrics: {
      checkedIn: tickets.filter((ticket) => ticket.status === "checked_in").length,
      provisionedEvents: summaries.filter((event) => Boolean(event.pk_gate_event)).length,
      totalEvents: summaries.length,
      totalTickets: tickets.length,
    },
    user,
  };
}

export async function getEventDetail(eventId: string) {
  const { supabase, user } = await requireOrganizer();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .single();

  if (eventError || !event) {
    notFound();
  }

  const [{ data: revocations }, { data: logs }] = await Promise.all([
    supabase
      .from("revocations")
      .select("event_id, pass_id, revoked_at")
      .eq("event_id", eventId)
      .order("revoked_at", { ascending: false }),
    supabase
      .from("gate_logs")
      .select("csv_url, event_id, id, uploaded_at")
      .eq("event_id", eventId)
      .order("uploaded_at", { ascending: false }),
  ]);

  return {
    event: event as unknown as EventRecord,
    logs: (logs ?? []) as GateLogRecord[],
    revocations: (revocations ?? []) as RevocationRecord[],
    user,
  };
}

export async function getEventOperations(eventId: string): Promise<OrganizerEventOperations> {
  const { accessToken } = await requireOrganizer();
  if (!accessToken) redirect("/login");

  const env = getPublicEnv();
  const response = await fetch(`${env.supabaseUrl}/functions/v1/organizer-ticket-summaries`, {
    body: JSON.stringify({ event_id: eventId }),
    cache: "no-store",
    headers: {
      apikey: env.anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 404) notFound();
  return parseEdgeFunctionResponse<OrganizerEventOperations>(response);
}
