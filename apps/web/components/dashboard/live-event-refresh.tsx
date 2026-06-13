"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { getBrowserPublicEnv } from "@/lib/env";

export function LiveEventRefresh({ eventId }: { eventId: string }) {
  const { supabase } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => router.refresh(), 5_000);
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const env = getBrowserPublicEnv();
    const channel = env.mode === "tunnel"
      ? supabase
        .channel(`event-operations-${eventId}`)
        .on("postgres_changes", { event: "*", filter: `event_id=eq.${eventId}`, schema: "public", table: "ticket_activity_log" }, refresh)
        .on("postgres_changes", { event: "*", filter: `event_id=eq.${eventId}`, schema: "public", table: "gate_checkins" }, refresh)
        .on("postgres_changes", { event: "*", filter: `event_id=eq.${eventId}`, schema: "public", table: "organizer_activity_log" }, refresh)
        .subscribe()
      : null;

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [eventId, router, supabase]);

  return null;
}
