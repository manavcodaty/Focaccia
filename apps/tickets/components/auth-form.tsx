'use client';

import Link from 'next/link';
import { AlertCircle, LockKeyhole } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { useAuth } from './auth-provider';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const next = searchParams.get('next');
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/tickets';
  const isProtectedReturn = Boolean(next);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const email = String(formData.get('email') ?? '').trim();
      const password = String(formData.get('password') ?? '');
      if (mode === 'signup') {
        const fullName = String(formData.get('full_name') ?? '').trim();
        await signUp(fullName, email, password);
      } else {
        await signIn(email, password);
      }
      router.replace(safeNext);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Authentication failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-composition fade-section">
      {isProtectedReturn ? <div className="protected-return-note"><span>RETURN PATH PRESERVED</span><strong>Sign in to continue where you left off.</strong><p>Your destination remains on this Focaccia origin and will be restored after authentication.</p></div> : null}
      <div className="auth-page-heading">
        <p className="ledger-caption">THE ACCOUNT OWNS THE TICKET</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your attendee account.'}</h1>
        <p>{mode === 'login' ? 'Recover tickets and continue private enrollment on another device.' : 'Your email and trusted name become the owner details for every ticket you claim.'}</p>
      </div>
      <div className="auth-card">
        <nav aria-label="Account action" className="auth-mode-switch">
          <Link aria-current={mode === 'signup' ? 'page' : undefined} href={`/signup${next ? `?next=${encodeURIComponent(safeNext)}` : ''}`}>Create account</Link>
          <Link aria-current={mode === 'login' ? 'page' : undefined} href={`/login${next ? `?next=${encodeURIComponent(safeNext)}` : ''}`}>Sign in</Link>
        </nav>
        <div className="auth-heading">
          <h2>{mode === 'login' ? 'Sign in' : 'Trusted attendee details'}</h2>
          <p>{mode === 'login' ? 'Use the account that owns the ticket.' : 'These details are separate from on-device biometric enrollment.'}</p>
        </div>
        <form action={submit} className="auth-form">
          <FieldGroup>
            {mode === 'signup' ? <Field><FieldLabel htmlFor="full-name">Full name</FieldLabel><Input autoComplete="name" id="full-name" maxLength={120} name="full_name" required type="text" /></Field> : null}
            <Field><FieldLabel htmlFor="email">Email address</FieldLabel><Input autoComplete="email" id="email" inputMode="email" name="email" required type="email" /></Field>
            <Field><FieldLabel htmlFor="password">Password</FieldLabel><Input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} id="password" minLength={8} name="password" required type="password" /><FieldDescription>Use at least eight characters.</FieldDescription></Field>
          </FieldGroup>
          {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>{mode === 'login' ? 'Sign in failed' : 'Account creation failed'}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          <Button className="w-full" disabled={pending} size="lg" type="submit">
            {pending ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in' : 'Create account')}
          </Button>
        </form>
      </div>
      <div className="auth-boundary-register"><LockKeyhole /><p><strong>Ticket identity only.</strong> Personal ticket records remain separate from local face processing. Raw face images and reusable embeddings are never stored in Supabase.</p></div>
    </div>
  );
}
