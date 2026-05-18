import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
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
    <main className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 bg-mesh overflow-hidden">
      {/* Texture overlay */}
      <div className="bg-noise absolute inset-0 z-0 opacity-40"></div>

      {/* Decorative Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--color-warm-mist)] opacity-40 rounded-full blur-[100px] mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[var(--color-fog)] opacity-60 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }}></div>

      <div className="relative grid w-full max-w-5xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        {/* Left: Brand messaging */}
        <section className="fade-section hidden max-w-lg lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--color-terracotta)]">
            Organizer access
          </p>
          <h1 className="display-heading mt-5 text-[44px] text-[var(--color-ink)]">
            Provision trust.
            <br />
            Keep the face off the network.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-[1.5] text-[var(--color-muted-stone)]">
            The organizer console creates event salts, signing keys, and join
            codes without ever becoming a storage layer for biometric data.
          </p>
        </section>

        {/* Right: Auth form */}
        <div className="fade-section fade-delay-1 flex justify-center lg:justify-end">
          <div className="hover-lift rounded-[24px]">
            <AuthCard />
          </div>
        </div>
      </div>
    </main>
  );
}
