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
    <div className="flex min-h-52 flex-col justify-between rounded-[20px] bg-ink p-5 text-canvas">
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
        <p className="mt-2 max-w-sm text-xs leading-5 text-white/55">Enrollment opens only after the attendee account owns this event-scoped ticket.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
          <div className="rounded-2xl bg-white/[0.06] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-white/40">Ticket</p>
            <p className="mt-1 text-xs font-medium text-white/80">General admission</p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-white/40">Limit</p>
            <p className="mt-1 text-xs font-medium text-white/80">1 per attendee</p>
          </div>
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
    <div className="relative min-h-72 overflow-hidden rounded-[20px] border border-ink/[0.06] bg-fog p-4">
      <m.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-6 left-0 w-20 bg-gradient-to-r from-transparent via-warm-mist/60 to-transparent"
        animate={reduced ? undefined : { x: ["-35%", "360%"] }}
        transition={{ duration: 4.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <div className="relative flex items-center justify-between text-xs text-light-steel">
        <span>Gate A</span>
        <span className="rounded-full bg-canvas px-3 py-1 shadow-hairline">Offline</span>
      </div>
      <div className="relative mt-4 rounded-2xl bg-canvas p-4 shadow-hairline">
        <div className="flex items-center gap-3">
          <m.span
            animate={reduced ? undefined : { transform: ["scale(1)", "scale(1.05)", "scale(1)"] }}
            transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="grid size-14 shrink-0 place-items-center rounded-full bg-warm-mist text-terracotta shadow-hairline"
          >
            <ShieldCheck className="size-7 stroke-[1.4]" />
          </m.span>
          <div className="min-w-0">
            <p className="text-lg font-medium text-ink">Admit</p>
            <p className="mt-1 text-xs leading-5 text-muted-stone">Verified offline at Gate A</p>
          </div>
          <span className="ml-auto rounded-full bg-fog px-3 py-1 text-xs text-muted-stone">Local</span>
        </div>
      </div>
      <div className="relative mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-stone">
        {["Pass", "Liveness", "Replay"].map((label, index) => (
          <div key={label} className="rounded-2xl bg-canvas px-3 py-2 shadow-hairline">
            <div className="flex items-center gap-1.5"><Check className="size-3 stroke-[2] text-terracotta" />{label}</div>
            <m.div
              aria-hidden="true"
              className="mt-2 h-1 rounded-full bg-terracotta"
              initial={{ width: reduced ? "100%" : "44%" }}
              animate={{ width: "100%" }}
              transition={{ duration: reduced ? 0 : 1.1, delay: index * 0.18, ease: [0.23, 1, 0.32, 1] }}
            />
          </div>
        ))}
      </div>
      <div className="relative mt-3 rounded-2xl bg-canvas/80 p-3 text-xs leading-5 text-muted-stone shadow-hairline">
        Signed decision stays on the device until sync returns.
      </div>
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
        {items.map((item, index) => (
          <m.div
            layout
            key={item.id}
            animate={{ backgroundColor: tick % 3 === index ? "#fff7f2" : "#f7f7f8", scale: tick % 3 === index ? 1.008 : 1 }}
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            transition={{ backgroundColor: { duration: 0.45, ease: [0.23, 1, 0.32, 1] }, layout: { type: "spring", stiffness: 160, damping: 28 }, scale: { duration: 0.45, ease: [0.23, 1, 0.32, 1] } }}
          >
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
