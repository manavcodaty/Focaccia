"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { getBrowserPublicEnv } from "@/lib/env";

export function LiveDashboardRefresh() {
  const { supabase } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => router.refresh(), 5_000);
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const channel = getBrowserPublicEnv().mode === "tunnel"
      ? supabase
        .channel("organizer-dashboard")
        .on("postgres_changes", { event: "*", schema: "public", table: "ticket_activity_log" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "gate_checkins" }, refresh)
        .subscribe()
      : null;

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  return null;
}
