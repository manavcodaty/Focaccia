'use client';

import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-shell route-message" id="main-content"><p className="overline">Application error</p><h1 className="display-heading">This page could not finish loading</h1><p>No checkout should be assumed complete. Retry the page, then check My tickets before submitting again.</p><Button onClick={reset} type="button">Try again</Button></main>;
}
