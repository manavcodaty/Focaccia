"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navLinks } from "@/lib/content";
import { getLandingPortalLinks } from "@/lib/portal-links";

export function Navigation() {
  const portalLinks = getLandingPortalLinks();

  return (
    <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-5">
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-[1180px] items-center rounded-full border border-white/70 bg-white/85 px-3 shadow-nav backdrop-blur-xl sm:px-4">
        <a href="#top" className="flex min-h-11 items-center rounded-full px-3 font-display text-2xl tracking-[-0.03em] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta">
          Focaccia
        </a>

        <div className="ml-auto hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="flex min-h-11 items-center rounded-full px-3.5 text-sm text-muted-stone transition-colors hover:bg-fog hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta">
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={portalLinks.organizerHref}>For organizers</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={portalLinks.attendeeHref}>Browse events</Link>
          </Button>
        </div>

        <div className="ml-auto sm:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-5 stroke-[1.5]" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>Focaccia</SheetTitle>
              <SheetDescription className="sr-only">Navigate the Focaccia landing page.</SheetDescription>
              <div className="mt-8 flex flex-col">
                {navLinks.map((link) => (
                  <SheetClose key={link.href} asChild>
                    <a href={link.href} className="flex min-h-14 items-center border-b border-ink/10 text-lg text-ink">
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
              </div>
              <div className="mt-8 grid gap-3">
                <SheetClose asChild><Button asChild><Link href={portalLinks.attendeeHref}>Browse events</Link></Button></SheetClose>
                <SheetClose asChild><Button asChild variant="outline"><Link href={portalLinks.organizerHref}>For organizers</Link></Button></SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
