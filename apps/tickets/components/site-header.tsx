'use client';

import Link from 'next/link';
import { LogOut, Menu, TicketCheck } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { useAuth } from './auth-provider';
import { Logo } from './logo';

const routes = [
  { href: '/', label: 'Discover' },
  { href: '/tickets', label: 'My tickets', protected: true },
  { href: '/privacy', label: 'Privacy' },
] as const;

export function SiteHeader() {
  const { loading, signOut, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/');
    } finally {
      setSigningOut(false);
    }
  }

  function isCurrent(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  const visibleRoutes = routes.filter((route) => !('protected' in route) || user);

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="header-inner">
        <Logo />
        <nav aria-label="Primary navigation" className="primary-nav desktop-navigation">
          {visibleRoutes.map((route) => (
            <Link aria-current={isCurrent(route.href) ? 'page' : undefined} href={route.href} key={route.href}>
              {route.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          {loading ? <output className="header-loading" aria-label="Loading account" /> : user ? (
            <Button className="desktop-account-action" disabled={signingOut} onClick={handleSignOut} variant="outline">
              <LogOut data-icon="inline-start" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          ) : (
            <Button asChild className="desktop-account-action"><Link href="/login">Sign in</Link></Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button aria-label="Open navigation" className="mobile-menu-trigger" size="icon" variant="outline"><Menu /></Button>
            </SheetTrigger>
            <SheetContent className="ticket-navigation-sheet" side="right">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><TicketCheck className="size-5 text-primary" />Focaccia tickets</SheetTitle>
                <SheetDescription>Find an event, recover a ticket, or review the privacy boundary.</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="mobile-navigation">
                {visibleRoutes.map((route) => (
                  <SheetClose asChild key={route.href}>
                    <Link aria-current={isCurrent(route.href) ? 'page' : undefined} href={route.href}>{route.label}</Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mobile-account-action">
                {user ? (
                  <Button className="w-full" disabled={signingOut} onClick={handleSignOut} variant="outline">
                    <LogOut data-icon="inline-start" />{signingOut ? 'Signing out…' : 'Sign out'}
                  </Button>
                ) : <SheetClose asChild><Button asChild className="w-full"><Link href="/login">Sign in</Link></Button></SheetClose>}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
