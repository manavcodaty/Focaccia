"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Plus, X } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { performSecureSignOut } from "@/lib/sign-out";

function getPageTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/events/new") return "Create Event";
  if (pathname.endsWith("/provisioning")) return "Gate Provisioning";
  if (pathname.endsWith("/revocations")) return "Revocations";
  if (pathname.endsWith("/logs")) return "Gate Logs";
  if (pathname.startsWith("/events/")) return "Event Overview";
  return "Focaccia";
}

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Create Event", href: "/events/new", icon: Plus },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { supabase, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const title = getPageTitle(pathname);
  const organizer = user?.email?.split("@")[0] ?? "organizer";

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      {/* Texture overlay */}
      <div className="bg-noise absolute inset-0 z-0 opacity-40"></div>

      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[var(--color-warm-mist)] opacity-30 rounded-full blur-[100px] mix-blend-multiply animate-pulse" style={{ animationDuration: '10s' }}></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[var(--color-fog)] opacity-50 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '15s', animationDelay: '2s' }}></div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-white/40 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <div className="mx-auto flex h-14 max-w-[var(--page-max-width)] items-center justify-between px-5 md:px-8">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.009em] text-[var(--color-ink)]"
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--color-ink)]">
                <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
                  <path
                    d="M8 2.5a5 5 0 00-5 5v1.75C3 12.6 5.4 14.7 8 15.5c2.6-.8 5-2.9 5-6.25V7.5a5 5 0 00-5-5z"
                    fill="rgba(255,255,255,0.15)"
                    stroke="white"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M6 8.5l1.5 1.5 3-3.5"
                    stroke="white"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              Focaccia
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href === "/dashboard" && pathname.startsWith("/events/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-[9999px] px-3.5 py-1.5 text-[14px] transition-colors duration-150 ${
                      isActive
                        ? "bg-[var(--color-fog)] font-medium text-[var(--color-ink)]"
                        : "text-[var(--color-muted-stone)] hover:bg-[var(--color-fog)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    {item.icon && <item.icon className="size-3.5" />}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: User + Actions */}
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-[var(--color-muted-stone)] md:block">
              {organizer}
            </span>
            <button
              onClick={() => void performSecureSignOut(supabase).then(() => window.location.assign("/login"))}
              className="hidden items-center gap-1.5 rounded-[9999px] px-3 py-1.5 text-[13px] text-[var(--color-muted-stone)] transition-colors hover:bg-[var(--color-fog)] hover:text-[var(--color-ink)] md:flex"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>

            {/* Mobile menu toggle */}
            <button
              className="flex size-9 items-center justify-center rounded-[9999px] text-[var(--color-ink)] md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-[var(--color-ink)]/[0.06] bg-[var(--color-canvas)] px-5 pb-4 pt-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-[16px] px-3 py-2.5 text-[15px] text-[var(--color-ink)] transition-colors hover:bg-[var(--color-fog)]"
                >
                  {item.icon && <item.icon className="size-4" />}
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--color-ink)]/[0.06] pt-3">
              <span className="text-[13px] text-[var(--color-muted-stone)]">{organizer}</span>
              <button
                onClick={() => void performSecureSignOut(supabase).then(() => window.location.assign("/login"))}
                className="flex items-center gap-1.5 rounded-[9999px] px-3 py-1.5 text-[13px] text-[var(--color-muted-stone)] hover:text-[var(--color-ink)]"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Page title bar */}
      <div className="border-b border-[var(--color-ink)]/[0.04] bg-[var(--color-fog)]/50">
        <div className="mx-auto flex h-10 max-w-[var(--page-max-width)] items-center px-5 md:px-8">
          <h1 className="text-[13px] font-medium text-[var(--color-muted-stone)]">
            {title}
          </h1>
        </div>
      </div>

      {/* Main content */}
      <main className="flex flex-1 flex-col px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-[var(--page-max-width)]">
          {children}
        </div>
      </main>
    </div>
  );
}
