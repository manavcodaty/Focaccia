"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { performSecureSignOut } from "@/lib/sign-out";

function getPageTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/events/new") return "Create event";
  if (pathname.endsWith("/edit")) return "Edit event";
  if (pathname.endsWith("/provisioning")) return "Gate provisioning";
  if (pathname.endsWith("/revocations")) return "Revocations";
  if (pathname.endsWith("/logs")) return "Gate logs";
  if (pathname.startsWith("/events/")) return "Event workspace";
  return "Organizer";
}

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Events" },
  { href: "/events/new", icon: Plus, label: "Create event" },
] as const;

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/events/new") return pathname === href;
  return pathname === "/dashboard" || (pathname.startsWith("/events/") && pathname !== "/events/new");
}

function Brand() {
  return (
    <Link
      aria-label="Focaccia Organizer dashboard"
      className="flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-1 text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      href="/dashboard"
    >
      <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground shadow-[var(--shadow-keyline)]">
        <ShieldCheck aria-hidden="true" className="size-4" />
      </span>
      <span>
        <span className="block text-[15px] font-semibold tracking-[-0.02em]">Focaccia</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Organizer</span>
      </span>
    </Link>
  );
}

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label={mobile ? "Mobile organizer navigation" : "Organizer navigation"} className="space-y-1">
      {navItems.map((item) => {
        const current = isCurrentRoute(pathname, item.href);
        const link = (
          <Link
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors duration-150",
              current
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-keyline)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            href={item.href}
          >
            <item.icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );

        return mobile ? (
          <SheetClose asChild key={item.href}>{link}</SheetClose>
        ) : (
          <div key={item.href}>{link}</div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { supabase, user } = useAuth();
  const title = getPageTitle(pathname);
  const organizerEmail = user?.email ?? "Organizer account";
  const signOut = () => void performSecureSignOut(supabase).then(() => window.location.assign("/login"));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground lg:flex">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <aside className="hidden w-[17rem] shrink-0 border-r border-border bg-card p-5 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col">
        <Brand />
        <div className="mt-8">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Workspace</p>
          <NavLinks />
        </div>
        <div className="mt-auto border-t border-border pt-5">
          <p className="truncate px-3 text-xs text-muted-foreground" title={organizerEmail}>{organizerEmail}</p>
          <Button className="mt-2 w-full justify-start" onClick={signOut} variant="ghost">
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-border bg-background/96 lg:hidden">
          <div className="flex min-h-16 items-center justify-between gap-3 px-5">
            <Brand />
            <Sheet>
              <SheetTrigger asChild>
                <Button aria-label="Open organizer navigation" size="icon" variant="outline">
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[min(88vw,22rem)] bg-card" side="right">
                <SheetHeader className="border-b border-border">
                  <SheetTitle>Organizer navigation</SheetTitle>
                  <SheetDescription>Manage events and gate readiness.</SheetDescription>
                </SheetHeader>
                <div className="p-4"><NavLinks mobile /></div>
                <SheetFooter className="border-t border-border">
                  <p className="truncate text-xs text-muted-foreground" title={organizerEmail}>{organizerEmail}</p>
                  <Button className="justify-start" onClick={signOut} variant="ghost">
                    <LogOut aria-hidden="true" />
                    Sign out
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <div className="border-b border-border bg-secondary/70">
          <div className="mx-auto flex min-h-12 max-w-[var(--page-max-width)] items-center gap-2 px-5 md:px-8">
            <CalendarDays aria-hidden="true" className="size-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
          </div>
        </div>

        <main className="mx-auto w-full max-w-[var(--page-max-width)] px-5 py-8 md:px-8 md:py-10" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
