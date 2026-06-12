'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
      <div className="auth-heading"><p className="overline">Profile required</p><h1 className="display-heading">Confirm your name.</h1><p>Your ticket email is fixed to <strong>{user.email}</strong>. Add the full name that should own the ticket.</p></div>
      <form action={submit} className="auth-form">
        <label>Full name<input autoComplete="name" name="full_name" required type="text" /></label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button className="button button-primary button-wide" disabled={pending} type="submit">{pending ? 'Saving' : 'Save profile'}</button>
      </form>
    </div>
  );
}
