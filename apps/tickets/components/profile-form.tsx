'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ticketApi } from '@/lib/api';

import { useAuth } from './auth-provider';

export function ProfileForm() {
  const { session, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) router.replace('/login?next=/profile');
  }, [router, user]);

  async function submit(formData: FormData) {
    if (!session) return;
    setPending(true);
    setError(null);
    try {
      await ticketApi.ensureAttendee(session.access_token, String(formData.get('full_name') ?? '').trim());
      window.location.assign('/tickets');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save your profile.');
      setPending(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="auth-card fade-section">
      <div className="auth-heading"><p className="overline">Profile required</p><h1 className="display-heading">Confirm your name</h1><p>Your ticket email is fixed to <strong>{user.email}</strong>. Add the full name that should own the ticket.</p></div>
      <form action={submit} className="auth-form">
        <Field><FieldLabel htmlFor="full-name"><UserRound />Full name</FieldLabel><Input autoComplete="name" id="full-name" maxLength={120} name="full_name" required type="text" /><FieldDescription>This trusted name will own every ticket you claim.</FieldDescription></Field>
        {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Profile could not be saved</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        <Button className="w-full" disabled={pending} size="lg" type="submit">{pending ? 'Saving…' : 'Save profile'}</Button>
      </form>
    </div>
  );
}
