'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from './auth-provider';
import { Logo } from './logo';

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

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="header-inner">
        <Logo />
        <nav aria-label="Primary navigation" className="primary-nav">
          <Link aria-current={pathname === '/' ? 'page' : undefined} href="/">Events</Link>
          {user ? <Link aria-current={pathname.startsWith('/tickets') ? 'page' : undefined} href="/tickets">My tickets</Link> : null}
          <Link aria-current={pathname === '/privacy' ? 'page' : undefined} href="/privacy">Privacy</Link>
        </nav>
        <div className="header-actions">
          {loading ? <output className="header-loading" aria-label="Loading account" /> : user ? (
            <button className="button button-ghost button-compact" disabled={signingOut} onClick={handleSignOut} type="button">
              {signingOut ? 'Signing out' : 'Sign out'}
            </button>
          ) : (
            <Link className="button button-primary button-compact" href="/login">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
