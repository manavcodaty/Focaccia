import { Suspense } from 'react';

import { AuthForm } from '@/components/auth-form';

export default function SignupPage() {
  return <main className="auth-page" id="main-content"><Suspense fallback={<div className="auth-card" aria-label="Loading sign up" />}><AuthForm mode="signup" /></Suspense></main>;
}
