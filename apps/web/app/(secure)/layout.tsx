import { redirect } from "next/navigation";

import { AppShell, type ShellEvent } from "@/components/layout/app-shell";
import { AuthProvider } from "@/components/providers/auth-provider";
import { getEventLifecycleState } from "@/lib/event-lifecycle";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SecureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const { data: eventRows } = await supabase
    .from("events")
    .select("event_id, name, starts_at, ends_at, pk_gate_event")
    .is("deleted_at", null)
    .order("starts_at", { ascending: false });

  const events: ShellEvent[] = (eventRows ?? []).map((event) => ({
    event_id: event.event_id as string,
    name: event.name as string,
    phase: getEventLifecycleState({
      ends_at: event.ends_at as string,
      pk_gate_event: event.pk_gate_event as string | null,
      starts_at: event.starts_at as string,
    }).phase,
  }));

  return (
    <AuthProvider initialUser={user}>
      <AppShell events={events}>{children}</AppShell>
    </AuthProvider>
  );
}
