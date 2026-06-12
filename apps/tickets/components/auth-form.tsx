'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from './auth-provider';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const next = searchParams.get('next');
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/tickets';

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
    <div className="auth-card fade-section">
      <div className="auth-heading">
        <p className="overline">Attendee account</p>
        <h1 className="display-heading">{mode === 'login' ? 'Welcome back.' : 'Save your place.'}</h1>
        <p>{mode === 'login' ? 'Sign in to recover tickets and continue enrollment on another device.' : 'Your email and name become the trusted owner details for every ticket you claim.'}</p>
      </div>
      <form action={submit} className="auth-form">
        {mode === 'signup' ? <label>Full name<input autoComplete="name" name="full_name" required type="text" /></label> : null}
        <label>Email address<input autoComplete="email" inputMode="email" name="email" required type="email" /></label>
        <label>Password<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} name="password" required type="password" /></label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button className="button button-primary button-wide" disabled={pending} type="submit">
          {pending ? (mode === 'login' ? 'Signing in' : 'Creating account') : (mode === 'login' ? 'Sign in' : 'Create account')}
        </button>
      </form>
      <p className="auth-switch">
        {mode === 'login' ? 'New to Focaccia?' : 'Already have an account?'}{' '}
        <Link href={`${mode === 'login' ? '/signup' : '/login'}${next ? `?next=${encodeURIComponent(safeNext)}` : ''}`}>
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </Link>
      </p>
      <p className="auth-privacy">Face images and reusable biometric templates are never stored in this ticket application.</p>
    </div>
  );
}
