'use client';

import { useRouter } from 'next/navigation';
import { AlertCircleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ticketApi } from '@/lib/api';

import { AuthShell } from './auth-form';
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
    <AuthShell title="Your name">
      <Card>
        <CardContent>
          <form action={submit} className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                <Input autoComplete="name" id="full-name" maxLength={120} name="full_name" required type="text" />
              </Field>
            </FieldGroup>
            {error ? <Alert role="alert" variant="destructive"><AlertCircleIcon /><AlertTitle>{error}</AlertTitle></Alert> : null}
            <Button className="w-full" disabled={pending} size="lg" type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
