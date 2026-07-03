"use client";

import { m, useReducedMotion } from "framer-motion";
import { Fingerprint, KeyRound, RefreshCcw, ShieldCheck, WifiOff } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/spotlight-card";
import { SyncQueue } from "@/components/animated-demos";

function EncryptionFlow() {
  const reduced = useReducedMotion();
  return (
    <div className="relative mt-8 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
      {[
        { label: "Attendee iPhone", detail: "Derive locally", icon: Fingerprint },
        { label: "Encrypted pass", detail: "Event-scoped", icon: KeyRound },
        { label: "Assigned gate", detail: "Decide offline", icon: ShieldCheck },
      ].map((item, index) => (
        <div key={item.label} className="contents">
          <div className="rounded-2xl bg-canvas p-4 shadow-hairline">
            <item.icon className="size-5 stroke-[1.4] text-terracotta" />
            <p className="mt-4 text-sm font-medium text-ink">{item.label}</p>
            <p className="mt-1 text-xs text-light-steel">{item.detail}</p>
          </div>
          {index < 2 ? (
            <div className="relative hidden h-px w-8 overflow-hidden bg-ink/10 sm:block">
              <m.span className="absolute inset-y-0 left-0 w-1/2 bg-terracotta" animate={reduced ? undefined : { transform: ["translateX(-100%)", "translateX(200%)"] }} transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function SecuritySection() {
  return (
    <section id="privacy" className="section-shell scroll-mt-28">
      <div className="section-heading-grid">
        <Reveal delay={0.05} className="max-w-3xl">
          <h2 className="section-title">Private by architecture, not by promise.</h2>
          <p className="section-copy">Biometric processing stays local. The server coordinates encrypted passes without becoming a biometric database.</p>
        </Reveal>
      </div>

      <div className="bento-grid grid-cols-1 lg:grid-cols-12">
        <Reveal className="lg:col-span-8">
          <SpotlightCard className="bento-card min-h-[350px] bg-fog p-6 sm:p-8">
            <div className="flex items-start justify-between gap-6">
              <div><p className="text-xs font-medium text-terracotta">Encrypted handoff</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-ink">Your face. Your device. Never our database.</h3></div>
              <KeyRound className="size-6 shrink-0 stroke-[1.4] text-ink" />
            </div>
            <EncryptionFlow />
          </SpotlightCard>
        </Reveal>

        <Reveal delay={0.06} className="lg:col-span-4">
          <SpotlightCard className="bento-card min-h-[350px] p-6">
            <div className="flex items-center justify-between"><p className="text-xs font-medium text-terracotta">Gate state</p><span className="relative flex size-3"><span className="absolute inline-flex size-full animate-ping rounded-full bg-terracotta/35 motion-reduce:animate-none" /><span className="relative inline-flex size-3 rounded-full bg-terracotta" /></span></div>
            <WifiOff className="mt-10 size-9 stroke-[1.25] text-ink" />
            <h3 className="mt-5 text-2xl font-medium tracking-[-0.035em] text-ink">Ready offline</h3>
            <p className="mt-2 text-sm leading-6 text-muted-stone">Pass signatures, replay state, liveness, and local matching remain available when the network is not.</p>
            <div className="mx-auto mt-8 w-full max-w-md rounded-2xl bg-fog p-4"><p className="text-xs text-light-steel">Revocation cache</p><p className="mt-1 text-sm font-medium text-ink">Refresh before doors open</p></div>
          </SpotlightCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-4">
          <SpotlightCard className="bento-card min-h-[300px] border-terracotta/15 bg-warm-mist/45 p-6">
            <RefreshCcw className="size-7 stroke-[1.3] text-terracotta" />
            <h3 className="mt-8 text-xl font-medium tracking-[-0.03em] text-ink">Revocations stay honest</h3>
            <p className="mt-3 text-sm leading-6 text-muted-stone">A remote revocation made while a gate is disconnected takes effect after that gate&apos;s next successful refresh.</p>
          </SpotlightCard>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-8">
          <SpotlightCard className="bento-card min-h-[300px] p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-medium text-terracotta">Signed synchronization</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-ink">Queue locally. Verify centrally.</h3></div><p className="max-w-xs text-sm leading-6 text-muted-stone">Original gate time and signed decisions survive a restart and synchronize when connectivity returns.</p></div>
            <div className="mt-7"><SyncQueue /></div>
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  );
}
