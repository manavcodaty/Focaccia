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
    <div className="auth-composition profile-composition fade-section">
      <div className="auth-page-heading"><p className="ledger-caption">PROFILE REQUIRED</p><h1>Confirm the ticket owner.</h1><p>Your email is fixed to <strong>{user.email}</strong>. Add the trusted full name that should own this ticket.</p></div>
      <div className="auth-card">
        <div className="auth-heading"><h2>Attendee folio</h2><p>The name below is used for ticket ownership, not biometric identity.</p></div>
        <form action={submit} className="auth-form">
          <Field><FieldLabel htmlFor="full-name"><UserRound />Full name</FieldLabel><Input autoComplete="name" id="full-name" maxLength={120} name="full_name" required type="text" /><FieldDescription>This trusted name will own every ticket you claim.</FieldDescription></Field>
          {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Profile could not be saved</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          <Button className="w-full" disabled={pending} size="lg" type="submit">{pending ? 'Saving…' : 'Save profile'}</Button>
        </form>
      </div>
    </div>
  );
}
