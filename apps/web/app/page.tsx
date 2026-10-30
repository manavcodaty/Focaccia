import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Button asChild className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50">
        <a href="#main-content">Skip to main content</a>
      </Button>

      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-6 px-5 md:px-8">
          <Link aria-label="PrivatePass organizer home" href="/"><Wordmark label="Organizer" /></Link>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <ModeToggle />
            <Button asChild size="sm"><Link href="/login">Sign in</Link></Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-16 px-5 py-14 md:px-8" id="main-content">
        <section className="flex flex-col gap-6">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Event entry that works offline.</h1>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/login">Open dashboard<ArrowRightIcon data-icon="inline-end" /></Link></Button>
          </div>
        </section>

        <Separator />

        <section aria-labelledby="privacy-heading" className="grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
          <h2 className="text-base font-semibold" id="privacy-heading">Privacy</h2>
          <p className="text-sm text-muted-foreground">Account and event records are stored. Face processing stays on trusted devices.</p>
        </section>
      </main>
    </div>
  );
}
