import "server-only";

import { notFound, redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  DashboardEventSummary,
  EventRecord,
  GateLogRecord,
  RevocationRecord,
} from "@/lib/types";

function groupCount<T extends { event_id: string }>(rows: T[]): Map<string, number> {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    map.set(row.event_id, (map.get(row.event_id) ?? 0) + 1);
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

  return { supabase, user };
}

export async function getDashboardData() {
  const { supabase, user } = await requireOrganizer();
  const { data: events, error } = await supabase
    .from("events")
    .select("created_at, ends_at, event_id, event_salt, join_code, name, pk_gate_event, pk_sign_event, starts_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const eventRows = (events ?? []) as EventRecord[];
  const eventIds = eventRows.map((event) => event.event_id);

  let revocations: RevocationRecord[] = [];
  let logs: GateLogRecord[] = [];

  if (eventIds.length > 0) {
  const [{ data: revocationData }, { data: logData }] = await Promise.all([
      supabase
        .from("revocations")
        .select("event_id, pass_id, revoked_at")
        .in("event_id", eventIds),
      supabase
        .from("gate_logs")
        .select("csv_url, event_id, id, uploaded_at")
        .in("event_id", eventIds),
    ]);

    revocations = (revocationData ?? []) as RevocationRecord[];
    logs = (logData ?? []) as GateLogRecord[];
  }

  const revocationCounts = groupCount(revocations);
  const logCounts = groupCount(logs);

  const summaries: DashboardEventSummary[] = eventRows.map((event) => ({
    ...event,
    logCount: logCounts.get(event.event_id) ?? 0,
    revocationCount: revocationCounts.get(event.event_id) ?? 0,
  }));

  return {
    events: summaries,
    metrics: {
      provisionedEvents: summaries.filter((event) => Boolean(event.pk_gate_event)).length,
      totalEvents: summaries.length,
      totalRevocations: revocations.length,
    },
    user,
  };
}

export async function getEventDetail(eventId: string) {
  const { supabase, user } = await requireOrganizer();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("created_at, ends_at, event_id, event_salt, join_code, name, pk_gate_event, pk_sign_event, starts_at")
    .eq("event_id", eventId)
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
    event: event as EventRecord,
    logs: (logs ?? []) as GateLogRecord[],
    revocations: (revocations ?? []) as RevocationRecord[],
    user,
  };
}
