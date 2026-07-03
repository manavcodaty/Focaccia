"use client";

import { m, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrowdCanvas } from "@/components/crowd-canvas";
import { getLandingPortalLinks } from "@/lib/portal-links";

export function Hero() {
  const reducedMotion = useReducedMotion();
  const portalLinks = getLandingPortalLinks();
  const entrance = reducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, transform: "translateY(20px)" }, animate: { opacity: 1, transform: "translateY(0px)" } };

  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden bg-canvas pt-28 text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[62%] bg-[radial-gradient(circle_at_50%_10%,rgba(251,225,209,0.72),transparent_55%)]" />
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 pt-[8vh] text-center sm:pt-[11vh]">
        <m.h1
          {...entrance}
          transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
          className="font-display text-[clamp(3.4rem,7vw,6.6rem)] leading-[0.9] tracking-[-0.055em] text-balance"
        >
          Your face is your ticket
        </m.h1>
        <m.p
          {...entrance}
          transition={{ duration: 0.65, delay: reducedMotion ? 0 : 0.12, ease: [0.23, 1, 0.32, 1] }}
          className="mt-6 max-w-xl text-base leading-7 text-muted-stone sm:text-lg"
        >
          Privacy-first biometric event access. No tickets to lose. No queues to stand in.
        </m.p>
        <m.div
          {...entrance}
          transition={{ duration: 0.65, delay: reducedMotion ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="group">
            <Link href={portalLinks.attendeeHref}>
              Browse Events
              <span className="grid size-7 place-items-center rounded-full bg-white/12 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <ArrowUpRight className="size-4 stroke-[1.5]" />
              </span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={portalLinks.organizerHref}>For Organizers</Link>
          </Button>
        </m.div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[58%] bg-gradient-to-b from-transparent via-white/20 to-white/85" />
      <CrowdCanvas />
      <a href="#how-it-works" className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-xs text-muted-stone backdrop-blur-md transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta">
        Explore the system
      </a>
    </section>
  );
}
