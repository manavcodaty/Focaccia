import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { AuthCard } from "@/components/dashboard/auth-card";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(178,91,54,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(34,26,18,0.12),_transparent_28%)]" />
      <div className="absolute left-8 top-8 inline-flex items-center gap-3 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/86 px-4 py-2 text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)] backdrop-blur-lg">
        <LockKeyhole className="size-3.5 text-[color:var(--primary)]" />
        Privacy-preserving organizer access
      </div>
      <div className="relative grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="fade-section hidden max-w-xl lg:block">
          <p className="text-[11px] uppercase tracking-[0.36em] text-[color:var(--muted-foreground)]">
            Event-scoped biometric entry
          </p>
          <h1 className="poster-title mt-5 text-6xl leading-[0.95] text-[color:var(--foreground)]">
            Provision trust.
            <br />
            Keep the raw face off the network.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[color:var(--muted-foreground)]">
            The organizer console creates event salts, signing keys, join codes, and the gate handoff surface without ever becoming a storage layer for biometric images.
          </p>
        </section>
        <div className="fade-section fade-delay-1 flex justify-center lg:justify-end">
          <AuthCard />
        </div>
      </div>
    </main>
  );
}
