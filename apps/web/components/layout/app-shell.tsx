"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, LayoutDashboard, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/events/new", icon: CalendarRange, label: "Create Event" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--background)]/88 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-6">
            <Link className="group inline-flex items-center gap-3" href="/dashboard">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_18px_40px_-28px_rgba(31,24,18,0.4)]">
                <ShieldCheck className="size-5 text-[color:var(--primary)]" />
              </div>
              <div>
                <div className="font-[family:var(--font-display)] text-2xl leading-none tracking-[0.02em] text-[color:var(--foreground)]">
                  One-Time Face Pass
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-[color:var(--muted-foreground)]">
                  Organizer Console
                </div>
              </div>
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                        : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)]",
                    )}
                    href={item.href}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}
