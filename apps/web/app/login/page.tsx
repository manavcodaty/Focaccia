import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { Logo } from "@/components/landing/logo";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="min-h-[100dvh] bg-[var(--color-canvas)]">
      <a className="skip-link" href="#main-content">Skip to sign in</a>
      <header className="mx-auto flex min-h-16 max-w-[var(--page-max-width)] items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="Focaccia home"><Logo className="h-8 w-36 text-[var(--color-ink)]" /></Link>
        <Link className="text-sm font-medium underline underline-offset-4" href="/">Back to overview</Link>
      </header>

      <main id="main-content" className="mx-auto grid max-w-[var(--page-max-width)] gap-10 px-5 py-12 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
        <section className="max-w-xl rounded-[24px] bg-[var(--color-warm-mist)] p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-terracotta)]">Organizer access</p>
          <h1 className="display-heading mt-4 text-4xl leading-tight sm:text-5xl">Run the event without putting a face on the network.</h1>
          <p className="mt-6 text-base leading-7 text-[var(--color-muted-stone)]">Create events, provision one trusted gate, review ticket state, and synchronize signed check-ins from a role-protected console.</p>
          <p className="mt-8 border-t border-[var(--color-terracotta)]/20 pt-6 text-sm leading-6 text-[var(--color-terracotta)]">Organizer access is allowlisted. An attendee account cannot promote itself.</p>
        </section>

        <div className="flex justify-center lg:justify-end"><AuthCard /></div>
      </main>
    </div>
  );
}
