'use client';

import Link from 'next/link';
import { AlertCircleIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

import { useAuth } from './auth-provider';
import { PrivatePassMark } from './brand';

export function AuthShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><PrivatePassMark /></span>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}

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
    <AuthShell title={mode === 'login' ? 'Sign in' : 'Create account'}>
      <Card>
        <CardContent>
          <form action={submit} className="flex flex-col gap-6">
            <FieldGroup>
              {mode === 'signup' ? (
                <Field>
                  <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                  <Input autoComplete="name" id="full-name" maxLength={120} name="full_name" required type="text" />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input autoComplete="email" id="email" inputMode="email" name="email" required type="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} id="password" minLength={8} name="password" required type="password" />
              </Field>
            </FieldGroup>
            {error ? (
              <Alert role="alert" variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            ) : null}
            <Button className="w-full" disabled={pending} size="lg" type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in' : 'Create account')}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={`${mode === 'login' ? '/signup' : '/login'}${next ? `?next=${encodeURIComponent(safeNext)}` : ''}`}>
          {mode === 'login' ? 'Create account' : 'Sign in'}
        </Link>
      </p>
    </AuthShell>
  );
}
