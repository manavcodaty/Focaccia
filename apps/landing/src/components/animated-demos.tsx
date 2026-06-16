"use client";

import { memo, useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Check, Cloud, CloudOff, KeyRound, Search, ShieldCheck, TicketCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export function EventSearchDemo() {
  return (
    <div className="rounded-[20px] bg-fog p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 stroke-[1.5] text-light-steel" />
        <Input aria-label="Search events" readOnly value="Summer Assembly" className="pl-10" />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-canvas p-3 shadow-hairline">
        <div>
          <p className="text-sm font-medium text-ink">Summer Assembly</p>
          <p className="mt-1 text-xs text-light-steel">General admission · Free</p>
        </div>
        <span className="rounded-full bg-warm-mist px-3 py-1 text-xs font-medium text-terracotta">Listed</span>
      </div>
    </div>
  );
}

export function TicketDemo() {
  return (
    <div className="flex min-h-44 flex-col justify-between rounded-[20px] bg-ink p-5 text-canvas">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/55">FOCACCIA PASS</span>
        <TicketCheck className="size-5 stroke-[1.5]" />
      </div>
      <div>
        <p className="font-display text-3xl tracking-[-0.03em]">One ticket, claimed.</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-white/65">
          <span className="size-1.5 rounded-full bg-[#fbe1d1]" />
          Ownership verified before enrollment
        </div>
      </div>
    </div>
  );
}

function EnrollmentDemoComponent() {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(reduced ? 100 : 28);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setProgress((current) => (current >= 100 ? 28 : current + 18)), 850);
    return () => window.clearInterval(timer);
  }, [reduced]);

  return (
    <div className="rounded-[20px] border border-terracotta/15 bg-warm-mist/55 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-canvas text-terracotta shadow-hairline"><KeyRound className="size-5 stroke-[1.5]" /></span>
        <div><p className="text-sm font-medium text-ink">Encrypting locally</p><p className="text-xs text-muted-stone">Event-scoped template</p></div>
      </div>
      <Progress className="mt-6" value={progress} />
      <div className="mt-3 flex justify-between text-xs text-muted-stone"><span>On this device</span><span>{progress}%</span></div>
    </div>
  );
}
export const EnrollmentDemo = memo(EnrollmentDemoComponent);

function GateDecisionDemoComponent() {
  const reduced = useReducedMotion();
  return (
    <div className="relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-[20px] bg-fog text-center">
      <m.span
        animate={reduced ? undefined : { transform: ["scale(1)", "scale(1.06)", "scale(1)"] }}
        transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="grid size-16 place-items-center rounded-full bg-canvas text-terracotta shadow-soft"
      >
        <ShieldCheck className="size-8 stroke-[1.4]" />
      </m.span>
      <p className="mt-4 text-lg font-medium text-ink">Admit</p>
      <p className="mt-1 text-xs text-muted-stone">Verified offline at Gate A</p>
    </div>
  );
}
export const GateDecisionDemo = memo(GateDecisionDemoComponent);

const readinessItems = [
  { id: "revocations", label: "Revocations refreshed", state: "Ready" },
  { id: "keys", label: "Gate keys provisioned", state: "Ready" },
  { id: "tickets", label: "Ticket inventory", state: "Synced" },
] as const;

function ReadinessListComponent() {
  const reduced = useReducedMotion();
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setOffset((value) => (value + 1) % readinessItems.length), 2400);
    return () => window.clearInterval(timer);
  }, [reduced]);
  const ordered = readinessItems.map((_, index) => readinessItems[(index + offset) % readinessItems.length]);

  return (
    <div className="space-y-2">
      {ordered.map((item) => (
        <m.div layout key={item.id} transition={{ type: "spring", stiffness: 180, damping: 22 }} className="flex items-center justify-between rounded-2xl border border-ink/[0.06] bg-canvas px-4 py-3">
          <span className="flex items-center gap-3 text-sm text-ink"><span className="grid size-6 place-items-center rounded-full bg-warm-mist text-terracotta"><Check className="size-3.5 stroke-[2]" /></span>{item.label}</span>
          <span className="text-xs text-light-steel">{item.state}</span>
        </m.div>
      ))}
    </div>
  );
}
export const ReadinessList = memo(ReadinessListComponent);

const commandPhrases = ["Show gates that need a refresh", "Find tickets awaiting enrollment", "Export today's attendance"];

function CommandDemoComponent() {
  const reduced = useReducedMotion();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [length, setLength] = useState(reduced ? commandPhrases[0].length : 0);

  useEffect(() => {
    if (reduced) return;
    const phrase = commandPhrases[phraseIndex];
    const timer = window.setTimeout(() => {
      if (length < phrase.length) setLength((value) => value + 1);
      else {
        setPhraseIndex((value) => (value + 1) % commandPhrases.length);
        setLength(0);
      }
    }, length < phrase.length ? 42 : 1500);
    return () => window.clearTimeout(timer);
  }, [length, phraseIndex, reduced]);

  return (
    <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-ink/10 bg-canvas px-4 shadow-hairline">
      <Search className="size-4 stroke-[1.5] text-light-steel" />
      <span className="text-sm text-muted-stone">{commandPhrases[phraseIndex].slice(0, length)}<span className="ml-0.5 inline-block h-4 w-px animate-cursor bg-terracotta align-middle" /></span>
    </div>
  );
}
export const CommandDemo = memo(CommandDemoComponent);

const queueStates = [
  { id: "north", label: "North entrance", state: "Queued", online: false },
  { id: "main", label: "Main entrance", state: "Signed", online: true },
  { id: "studio", label: "Studio entrance", state: "Synced", online: true },
] as const;

function SyncQueueComponent() {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 2600);
    return () => window.clearInterval(timer);
  }, [reduced]);
  const items = queueStates.map((item, index) => ({ ...item, state: tick % 3 === index ? "Synced" : item.state, online: tick % 3 === index ? true : item.online }));
  return (
    <div className="grid gap-2">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <m.div layout key={item.id} className="flex items-center gap-3 rounded-2xl bg-fog px-4 py-3" transition={{ type: "spring", stiffness: 180, damping: 24 }}>
            {item.online ? <Cloud className="size-4 stroke-[1.5] text-terracotta" /> : <CloudOff className="size-4 stroke-[1.5] text-light-steel" />}
            <span className="text-sm text-ink">{item.label}</span>
            <span className="ml-auto text-xs text-light-steel">{item.state}</span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
export const SyncQueue = memo(SyncQueueComponent);
