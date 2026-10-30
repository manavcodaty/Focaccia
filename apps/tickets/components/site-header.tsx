'use client';

import { LogOutIcon, MenuIcon, TicketIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ModeToggle } from '@/components/mode-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useAuth } from './auth-provider';
import { Logo } from './logo';
import { pageContainer } from './page';

const routes = [
  { href: '/', label: 'Events' },
  { href: '/tickets', label: 'My tickets', protected: true },
] as const;

function initials(name: string | undefined, email: string | undefined) {
  const source = name?.trim() || email?.split('@')[0] || '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'ME';
}

export function SiteHeader() {
  const { loading, profile, signOut, user } = useAuth();
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

  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const visibleRoutes = routes.filter((route) => !('protected' in route) || user);

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <Button asChild className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50">
        <a href="#main-content">Skip to content</a>
      </Button>
      <div className={cn(pageContainer, "flex h-16 items-center gap-8")}>
        <Logo />
        <span className="text-sm text-muted-foreground">Tickets</span>
        <nav aria-label="Primary navigation" className="hidden items-center gap-2 md:flex">
          {visibleRoutes.map((route) => (
            <Button asChild className={cn(!isCurrent(route.href) && 'text-muted-foreground')} key={route.href} size="sm" variant={isCurrent(route.href) ? 'secondary' : 'ghost'}>
              <Link aria-current={isCurrent(route.href) ? 'page' : undefined} href={route.href}>{route.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          {loading ? (
            <Skeleton aria-label="Loading account" className="size-8 rounded-full" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="Account menu" className="hidden rounded-full md:inline-flex" size="icon-sm" variant="ghost">
                  <Avatar className="size-8"><AvatarFallback>{initials(profile?.full_name, user.email)}</AvatarFallback></Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col font-normal">
                  <span className="truncate font-medium text-foreground">{profile?.full_name ?? 'Your account'}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild><Link href="/tickets"><TicketIcon />My tickets</Link></DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled={signingOut} onSelect={() => void handleSignOut()}><LogOutIcon />{signingOut ? 'Signing out…' : 'Sign out'}</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="hidden md:inline-flex" size="sm"><Link href="/login">Sign in</Link></Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button aria-label="Open navigation" className="md:hidden" size="icon-sm" variant="ghost"><MenuIcon /></Button>
            </SheetTrigger>
            <SheetContent className="w-[min(88vw,20rem)]" side="right">
              <SheetHeader>
                <SheetTitle>PrivatePass Tickets</SheetTitle>
                <SheetDescription className={user ? undefined : 'sr-only'}>{user ? user.email : 'Navigation'}</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="flex flex-col gap-2 px-4">
                {visibleRoutes.map((route) => (
                  <SheetClose asChild key={route.href}>
                    <Button asChild className="justify-start" size="lg" variant={isCurrent(route.href) ? 'secondary' : 'ghost'}>
                      <Link aria-current={isCurrent(route.href) ? 'page' : undefined} href={route.href}>{route.label}</Link>
                    </Button>
                  </SheetClose>
                ))}
              </nav>
              <SheetFooter>
                {user ? (
                  <Button className="w-full" disabled={signingOut} onClick={() => void handleSignOut()} variant="outline">
                    <LogOutIcon data-icon="inline-start" />{signingOut ? 'Signing out…' : 'Sign out'}
                  </Button>
                ) : (
                  <SheetClose asChild><Button asChild className="w-full"><Link href="/login">Sign in</Link></Button></SheetClose>
                )}
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
