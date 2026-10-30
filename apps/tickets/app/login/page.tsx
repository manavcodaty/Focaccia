import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthForm } from '@/components/auth-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 md:px-8 md:py-14" id="main-content">
      <Suspense fallback={<Skeleton aria-label="Loading sign in" className="h-96 w-full max-w-sm rounded-xl" />}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
