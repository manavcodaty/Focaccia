'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, LockKeyhole } from 'lucide-react';
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
        <h1 className="display-heading">{mode === 'login' ? 'Welcome back' : 'Save your place'}</h1>
        <p>{mode === 'login' ? 'Sign in to recover tickets and continue enrollment on another device.' : 'Your email and name become the trusted owner details for every ticket you claim.'}</p>
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
          {!pending ? <ArrowRight data-icon="inline-end" /> : null}
        </Button>
      </form>
      <p className="auth-switch">
        {mode === 'login' ? 'New to Focaccia?' : 'Already have an account?'}{' '}
        <Link href={`${mode === 'login' ? '/signup' : '/login'}${next ? `?next=${encodeURIComponent(safeNext)}` : ''}`}>
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </Link>
      </p>
      <div className="auth-privacy"><LockKeyhole /><p><strong>Ticket identity only.</strong> This app stores the personal and operational records required for your ticket. Raw face images and reusable embeddings are not stored in Supabase.</p></div>
    </div>
  );
}
