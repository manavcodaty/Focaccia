import { ArrowRight, Check, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/landing/logo";

const proofPoints = [
  {
    description: "Attendee templates are encrypted and kept on the attendee device.",
    icon: ShieldCheck,
    title: "No central biometric store",
  },
  {
    description: "Provisioned gates verify signed passes even when the venue network is unavailable.",
    icon: Check,
    title: "Offline entry remains available",
  },
  {
    description: "Check-ins and revocations reconcile when a trusted connection returns.",
    icon: RefreshCw,
    title: "Operational state stays visible",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="border-b border-[var(--color-ink)]/[0.08]">
        <div className="mx-auto flex min-h-16 max-w-[var(--page-max-width)] items-center justify-between gap-4 px-5 md:px-8">
          <Logo className="h-8 w-36 text-[var(--color-ink)]" />
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-ink)] px-5 text-sm font-medium transition-colors hover:bg-[var(--color-fog)]">
            Organizer sign in
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section className="mx-auto grid max-w-[var(--page-max-width)] gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-terracotta)]">Privacy-preserving event entry</p>
            <h1 className="display-heading mt-5 text-[clamp(3rem,7vw,5.5rem)] leading-[0.98] text-[var(--color-ink)]">A faster gate without a biometric database.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--color-muted-stone)]">
              Focaccia binds each attendee pass to one event, verifies it locally at the door, and keeps biometric processing on trusted devices.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-base font-medium text-white transition-colors hover:bg-black">
                Open organizer console
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-full px-5 text-base font-medium text-[var(--color-ink)] underline decoration-[var(--color-hint-of-grey)] underline-offset-4 hover:decoration-[var(--color-ink)]">
                Review the operating model
              </a>
            </div>
          </div>

          <aside aria-label="Event entry operating model" className="rounded-[24px] bg-[var(--color-warm-mist)] p-6 shadow-[var(--shadow-subtle)] sm:p-8">
            <p className="text-sm font-medium text-[var(--color-terracotta)]">Before doors open</p>
            <ol className="mt-6 space-y-5">
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-semibold">1</span>
                <div><h2 className="font-semibold">Refresh revocations</h2><p className="mt-1 text-sm leading-6 text-[var(--color-muted-stone)]">Confirm the gate cache is current before admitting attendees.</p></div>
              </li>
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-semibold">2</span>
                <div><h2 className="font-semibold">Verify locally</h2><p className="mt-1 text-sm leading-6 text-[var(--color-muted-stone)]">The gate checks signature, event binding, liveness, and replay state offline.</p></div>
              </li>
              <li className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-semibold">3</span>
                <div><h2 className="font-semibold">Synchronize receipts</h2><p className="mt-1 text-sm leading-6 text-[var(--color-muted-stone)]">Durable check-in records reach the dashboard when connectivity returns.</p></div>
              </li>
            </ol>
          </aside>
        </section>

        <section id="how-it-works" className="border-y border-[var(--color-ink)]/[0.08] bg-[var(--color-fog)]">
          <div className="mx-auto max-w-[var(--page-max-width)] px-5 py-14 md:px-8 md:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-terracotta)]">Built for the operating day</p>
              <h2 className="display-heading mt-3 text-4xl sm:text-5xl">Clear state at every handoff.</h2>
            </div>
            <div className="mt-10 divide-y divide-[var(--color-ink)]/[0.1] border-y border-[var(--color-ink)]/[0.1]">
              {proofPoints.map((point) => (
                <article key={point.title} className="grid gap-4 py-6 sm:grid-cols-[3rem_0.8fr_1.2fr] sm:items-center">
                  <point.icon aria-hidden="true" className="size-6 text-[var(--color-terracotta)]" />
                  <h3 className="text-lg font-semibold">{point.title}</h3>
                  <p className="text-sm leading-6 text-[var(--color-muted-stone)]">{point.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
