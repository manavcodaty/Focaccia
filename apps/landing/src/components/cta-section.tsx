import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";

export function CtaSection() {
  return (
    <section className="section-shell pt-0">
      <Reveal>
        <div className="relative overflow-hidden rounded-[28px] bg-warm-mist px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
          <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border border-terracotta/10" />
          <div className="pointer-events-none absolute -right-2 -top-8 size-44 rounded-full border border-terracotta/15" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-medium text-terracotta">Ready when the doors are</p>
            <h2 className="mt-5 font-display text-[clamp(3rem,6vw,5.4rem)] leading-[0.92] tracking-[-0.05em] text-ink">Make entry feel effortless.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-stone">Claim a free ticket for an upcoming event, or open the organizer workspace to prepare your own.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="group"><Link href="/events">Browse events <ArrowUpRight className="size-4 stroke-[1.5] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/organizer/login">For organizers</Link></Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
