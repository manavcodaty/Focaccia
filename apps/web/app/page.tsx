import { ArrowRight, Check, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/landing/logo";
import { Button } from "@/components/ui/button";

const proofPoints = [
  {
    description: "Enrollment derives a face template, then removes temporary capture files instead of retaining raw face images as records.",
    icon: ShieldCheck,
    title: "Raw captures are temporary",
  },
  {
    description: "A provisioned gate can verify a signed, event-bound pass while the venue connection is unavailable.",
    icon: Check,
    title: "Offline verification is explicit",
  },
  {
    description: "Revocations and signed check-in receipts reconcile with the organizer service when a trusted connection returns.",
    icon: RefreshCw,
    title: "Operational state stays visible",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-18 max-w-[var(--page-max-width)] items-center justify-between gap-4 px-5 md:px-8">
          <Logo className="h-8 w-36 text-foreground" />
          <Button asChild variant="outline"><Link href="/login">Organizer sign in</Link></Button>
        </div>
      </header>

      <main id="main-content">
        <section className="mx-auto grid max-w-[var(--page-max-width)] gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
          <div className="max-w-3xl fade-section">
            <p className="eyebrow">Privacy-preserving event entry</p>
            <h1 className="display-heading mt-5 text-[clamp(3rem,7vw,5.8rem)] leading-[0.96]">Know what is ready before the doors open.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
              Focaccia connects ticketing, attendee enrollment, and local gate verification without turning raw camera captures into a central biometric archive.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login">Open organizer console<ArrowRight aria-hidden="true" /></Link>
              </Button>
              <Button asChild size="lg" variant="ghost"><a href="#operating-model">Review the operating model</a></Button>
            </div>
          </div>

          <aside aria-label="Event entry readiness checklist" className="fade-section rounded-[var(--radius-panel)] border border-primary/15 bg-[var(--color-warm-mist)] p-6 shadow-[var(--shadow-keyline)] sm:p-8">
            <p className="eyebrow">Door-day readiness</p>
            <ol className="mt-7 divide-y divide-primary/15">
              {[
                ["01", "Refresh revocations", "Confirm the gate cache is current before admitting attendees."],
                ["02", "Verify locally", "Check signature, event binding, liveness, and replay state on the trusted gate."],
                ["03", "Synchronize receipts", "Return durable check-in records when connectivity is available."],
              ].map(([number, title, copy]) => (
                <li className="grid grid-cols-[2.5rem_1fr] gap-4 py-5 first:pt-0 last:pb-0" key={number}>
                  <span className="token-mono text-xs font-semibold text-primary">{number}</span>
                  <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p></div>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section className="border-y border-border bg-secondary/70" id="operating-model">
          <div className="mx-auto max-w-[var(--page-max-width)] px-5 py-14 md:px-8 md:py-20">
            <div className="max-w-3xl">
              <p className="eyebrow">The real privacy boundary</p>
              <h2 className="display-heading mt-3 text-4xl leading-tight sm:text-5xl">Useful records, clear limits.</h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Focaccia keeps personal and operational records needed to run an event, including accounts, tickets, signed pass data, revocations, and check-in receipts. Raw face images are processed as temporary files on trusted devices and are not retained after template extraction.
              </p>
            </div>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {proofPoints.map((point) => (
                <article className="grid gap-4 py-6 sm:grid-cols-[3rem_0.8fr_1.2fr] sm:items-center" key={point.title}>
                  <point.icon aria-hidden="true" className="size-6 text-primary" />
                  <h3 className="text-lg font-semibold">{point.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{point.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
