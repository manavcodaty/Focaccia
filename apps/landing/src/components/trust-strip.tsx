import { CircleOff, KeyRound, ShieldCheck, WifiOff } from "lucide-react";

const points = [
  { label: "No central biometric store", icon: CircleOff },
  { label: "Event-scoped encryption", icon: KeyRound },
  { label: "Offline gate decisions", icon: WifiOff },
  { label: "Signed, replay-safe sync", icon: ShieldCheck },
] as const;

export function TrustStrip() {
  return (
    <section aria-label="Core privacy properties" className="border-y border-ink/[0.07] bg-fog/70">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 divide-y divide-ink/[0.07] px-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-8 lg:grid-cols-4 lg:px-10">
        {points.map((point) => (
          <div key={point.label} className="flex min-h-20 items-center gap-3 px-4 text-sm text-muted-stone first:pl-0 last:pr-0 sm:px-6">
            <point.icon className="size-4 shrink-0 stroke-[1.4] text-terracotta" />
            {point.label}
          </div>
        ))}
      </div>
    </section>
  );
}
