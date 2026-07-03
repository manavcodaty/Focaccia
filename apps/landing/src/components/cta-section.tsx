"use client";

import { m, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ShieldCheck, Ticket, WifiOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { getLandingPortalLinks } from "@/lib/portal-links";

const ctaStatusItems = [
  { label: "Ticket claimed", detail: "One free pass", icon: Ticket },
  { label: "Gate ready", detail: "Offline cache", icon: WifiOff },
  { label: "Entry verified", detail: "Signed decision", icon: ShieldCheck },
] as const;

export function CtaSection() {
  const portalLinks = getLandingPortalLinks();
  const reduced = useReducedMotion();

  return (
    <section className="section-shell pt-0">
      <Reveal>
        <div className="relative overflow-hidden rounded-[28px] border border-terracotta/10 bg-warm-mist px-6 py-14 shadow-soft sm:px-12 sm:py-16 lg:px-20">
          <m.div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border border-terracotta/10"
            animate={reduced ? undefined : { scale: [1, 1.06, 1], x: [0, -10, 0], y: [0, 8, 0] }}
            transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <m.div
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 -top-8 size-44 rounded-full border border-terracotta/15"
            animate={reduced ? undefined : { scale: [1, 0.94, 1], x: [0, 8, 0], y: [0, -6, 0] }}
            transition={{ duration: 6.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(330px,0.55fr)] lg:items-center">
            <div>
              <h2 className="font-display text-[clamp(3rem,5.2vw,5.4rem)] leading-[0.95] tracking-[-0.04em] text-ink">Make entry feel effortless.</h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-stone">Claim a free ticket for an upcoming event, or open the organizer workspace to prepare your own.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="group"><Link href={portalLinks.attendeeHref}>Browse events <ArrowUpRight className="size-4 stroke-[1.5] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link></Button>
                <Button asChild size="lg" variant="outline"><Link href={portalLinks.organizerHref}>For organizers</Link></Button>
              </div>
            </div>

            <div className="relative rounded-[24px] border border-ink/[0.07] bg-canvas/85 p-2 shadow-hairline">
              <div className="rounded-[18px] bg-fog p-3">
                <div className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3 shadow-hairline">
                  <span className="text-xs font-medium text-terracotta">Entry path</span>
                  <span className="flex items-center gap-2 text-xs text-light-steel"><span className="size-1.5 rounded-full bg-terracotta" /> Live demo</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {ctaStatusItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3 shadow-hairline"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warm-mist text-terracotta"><item.icon className="size-4 stroke-[1.5]" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{item.label}</span>
                        <span className="block text-xs text-light-steel">{item.detail}</span>
                      </span>
                      <ShieldCheck className="ml-auto size-4 shrink-0 stroke-[1.6] text-terracotta" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
