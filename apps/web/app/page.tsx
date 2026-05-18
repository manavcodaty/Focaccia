import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-mesh overflow-hidden">
      {/* Texture overlay */}
      <div className="bg-noise absolute inset-0 z-0 opacity-40"></div>

      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[var(--color-warm-mist)] opacity-30 rounded-full blur-[100px] mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[var(--color-fog)] opacity-60 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }}></div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-[var(--page-max-width)] items-center justify-between px-5 py-6 md:px-8">
        <div className="flex items-center gap-2.5 text-[16px] font-medium tracking-tight text-[var(--color-ink)]">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-b from-[var(--color-ink)] to-[#2a2c30] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
            <svg viewBox="0 0 16 16" fill="none" className="size-4">
              <path d="M8 2.5a5 5 0 00-5 5v1.75C3 12.6 5.4 14.7 8 15.5c2.6-.8 5-2.9 5-6.25V7.5a5 5 0 00-5-5z" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="1.2" />
              <path d="M6 8.5l1.5 1.5 3-3.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          Focaccia
        </div>
        <Link
          href="/login"
          className="btn-magic glass-panel inline-flex items-center rounded-full px-5 py-2 text-[14px] font-medium text-[var(--color-ink)] transition-premium hover:bg-white/80"
        >
          Organizer console
        </Link>
      </header>

      {/* Hero */}
      <section className="fade-section relative z-10 mx-auto flex max-w-[var(--page-max-width)] flex-col items-center justify-center px-5 pb-24 pt-20 text-center md:px-8 md:pt-32">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-terracotta)]/20 bg-[var(--color-warm-mist)]/30 px-3 py-1.5 backdrop-blur-sm">
          <div className="size-1.5 rounded-full bg-[var(--color-terracotta)] animate-pulse"></div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-terracotta)]">
            Privacy-preserving event entry
          </p>
        </div>
        
        <h1 className="display-heading mt-8 max-w-4xl text-[56px] text-[var(--color-ink)] md:text-[88px] leading-[1.05]">
          Biometric entry <br className="hidden md:block"/>without the database
        </h1>
        
        <p className="mt-8 max-w-2xl text-[18px] leading-[1.6] text-[var(--color-muted-stone)]">
          Focaccia proves that event access can be face-verified, completely offline, and resistant to QR theft — without ever storing biometric data centrally.
        </p>
        
        <div className="mt-10 flex flex-wrap justify-center items-center gap-4">
          <Link
            href="/login"
            className="btn-magic inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-8 py-4 text-[16px] font-medium text-[var(--color-canvas)] shadow-[0_8px_20px_rgba(23,25,28,0.15)] transition-premium hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(23,25,28,0.25)]"
          >
            Create an event
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-24 grid w-full max-w-5xl gap-6 sm:grid-cols-3 text-left">
          {[
            {
              icon: <svg className="size-6 text-[var(--color-terracotta)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
              title: "On-device processing",
              description: "Face embeddings are converted into cancelable templates entirely on the attendee's phone. Biometrics never leave the device.",
            },
            {
              icon: <svg className="size-6 text-[var(--color-ink)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.906 14.142 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>,
              title: "Offline gate verification",
              description: "The gate device verifies passes without network connectivity. Cryptographic signatures and liveness checks execute locally.",
            },
            {
              icon: <svg className="size-6 text-[var(--color-ink)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
              title: "Event-scoped passes",
              description: "Each pass is mathematically bound to a specific event ID and salt. A compromised template from one event is useless elsewhere.",
            },
          ].map((feature) => (
            <div key={feature.title} className="hover-lift glass-panel rounded-[24px] p-8 transition-premium group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/50 shadow-sm border border-white/60">
                  {feature.icon}
                </div>
                <h3 className="text-[18px] font-semibold text-[var(--color-ink)] tracking-tight">{feature.title}</h3>
                <p className="text-[14px] leading-[1.6] text-[var(--color-muted-stone)]">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
