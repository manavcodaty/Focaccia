import { ArrowDownRight, LockKeyhole, ScanFace, Ticket } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/spotlight-card";
import { EventSearchDemo, TicketDemo, EnrollmentDemo, GateDecisionDemo } from "@/components/animated-demos";

const steps = [
  { number: "01", title: "Browse an event", description: "Find a listed event and see the available free ticket before signing in.", icon: Ticket, demo: <EventSearchDemo />, className: "md:col-span-1 lg:col-span-7", contentClassName: "" },
  { number: "02", title: "Claim one free ticket", description: "Ownership is attached to the attendee account and enforced server-side.", icon: ArrowDownRight, demo: <TicketDemo />, className: "md:col-span-1 lg:col-span-5", contentClassName: "" },
  { number: "03", title: "Enroll privately", description: "Face capture and template derivation stay on the attendee's iPhone.", icon: LockKeyhole, demo: <EnrollmentDemo />, className: "md:col-span-1 lg:col-span-5", contentClassName: "px-5 sm:px-0" },
  { number: "04", title: "Enter at an offline gate", description: "The prepared gate checks the pass, liveness, replay state, and local match.", icon: ScanFace, demo: <GateDecisionDemo />, className: "md:col-span-1 lg:col-span-7", contentClassName: "" },
] as const;

export function JourneySection() {
  return (
    <section id="how-it-works" className="section-shell scroll-mt-28">
      <div className="section-heading-grid">
        <Reveal delay={0.05} className="max-w-3xl">
          <h2 className="section-title">From discovery to the door.</h2>
          <p className="section-copy">One continuous attendee journey, with privacy and ownership checks built into every handoff.</p>
        </Reveal>
      </div>
      <div className="bento-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12">
        {steps.map((step, index) => (
          <Reveal key={step.number} delay={index * 0.06} className={step.className}>
            <SpotlightCard className="bento-card flex min-h-[420px] flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className={step.contentClassName}><p className="text-xs font-medium text-terracotta">{step.number}</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-ink">{step.title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-stone">{step.description}</p></div>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fog"><step.icon className="size-5 stroke-[1.4] text-ink" /></span>
              </div>
              <div className="mt-auto pt-8">{step.demo}</div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
