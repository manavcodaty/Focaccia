import { ArrowUpRight, Check, Download, Radio, UsersRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Reveal } from "@/components/reveal";
import { CommandDemo, ReadinessList } from "@/components/animated-demos";
import { getLandingPortalLinks } from "@/lib/portal-links";

export function OrganizerSection() {
  const portalLinks = getLandingPortalLinks();

  return (
    <section id="organizers" className="section-shell scroll-mt-28">
      <div className="section-heading-grid">
        <Reveal delay={0.05} className="max-w-3xl">
          <h2 className="section-title">Run the room, not the queue.</h2>
          <p className="section-copy">Create the event, provision the gate, watch readiness, and export the evidence from one calm operating surface.</p>
        </Reveal>
      </div>

      <Reveal className="mt-14">
        <div className="rounded-[28px] border border-ink/[0.07] bg-fog p-2 shadow-soft">
          <div className="rounded-[22px] bg-canvas p-5 sm:p-7">
            <div className="flex flex-col gap-5 border-b border-ink/10 pb-6 lg:flex-row lg:items-center">
              <div><p className="text-xs font-medium text-terracotta">Event operations</p><h3 className="mt-2 text-2xl font-medium tracking-[-0.035em] text-ink">Summer Assembly</h3></div>
              <div className="lg:ml-auto lg:w-[460px]"><CommandDemo /></div>
              <Button asChild variant="outline"><Link href={portalLinks.organizerHref}>Open dashboard <ArrowUpRight className="size-4 stroke-[1.5]" /></Link></Button>
            </div>

            <div className="grid gap-8 py-7 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <div className="flex items-center justify-between"><h4 className="text-sm font-medium text-ink">Door readiness</h4><span className="text-xs text-light-steel">All required checks</span></div>
                <div className="mt-4"><ReadinessList /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] bg-fog p-5">
                  <div className="flex items-center justify-between"><UsersRound className="size-5 stroke-[1.4] text-ink" /><span className="text-xs text-light-steel">Capacity</span></div>
                  <p className="mt-8 text-lg font-medium text-ink">Within event limit</p>
                  <Progress value={64} className="mt-4" aria-label="Example capacity progress" />
                  <p className="mt-3 text-xs text-light-steel">Inventory remains server-enforced</p>
                </div>
                <div className="rounded-[20px] bg-ink p-5 text-canvas">
                  <div className="flex items-center justify-between"><Radio className="size-5 stroke-[1.4]" /><span className="text-xs text-white/55">Gate A</span></div>
                  <p className="mt-8 text-lg font-medium">Ready for doors</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-white/60"><span className="size-1.5 rounded-full bg-warm-mist" />Provisioned · Cache refreshed</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-ink/10 pt-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex flex-wrap gap-3" aria-label="Recent attendance stream">
                {["Pass admitted", "Replay blocked", "Decision queued"].map((label, index) => (
                  <div key={label} className="flex min-w-fit items-center gap-2 rounded-full bg-fog px-4 py-2 text-xs text-muted-stone"><span className="grid size-5 place-items-center rounded-full bg-canvas text-terracotta shadow-hairline"><Check className="size-3 stroke-[2]" /></span>{label}<span className="text-hint">{index + 1}m</span></div>
                ))}
              </div>
              <Button variant="ghost" className="justify-self-start lg:justify-self-end"><Download className="size-4 stroke-[1.5]" /> Export CSV</Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
