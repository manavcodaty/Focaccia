import type { Metadata } from 'next';

import { ProfileForm } from '@/components/profile-form';

export const metadata: Metadata = { title: 'Your profile' };

export default function ProfilePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 md:px-8 md:py-14" id="main-content">
      <ProfileForm />
    </main>
  );
}
