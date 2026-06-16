import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="bg-fog">
      <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="font-display text-3xl tracking-[-0.03em] text-ink">Focaccia</p><p className="mt-2 max-w-sm text-sm leading-6 text-muted-stone">Privacy-preserving event entry, designed to keep biometric decisions on prepared devices.</p></div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-stone">
            <Link href="/events" className="hover:text-ink">Events</Link><Link href="/organizer/login" className="hover:text-ink">Organizers</Link><a href="#privacy" className="hover:text-ink">Privacy</a><span>Terms</span>
          </nav>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col gap-2 text-xs text-light-steel sm:flex-row sm:justify-between"><span>© 2026 Focaccia</span><span>Built for accountable, offline-capable entry.</span></div>
      </div>
    </footer>
  );
}
