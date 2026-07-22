import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  return (
    <main className="page-shell prose-page" id="main-content">
      <div className="prose-heading fade-section"><p className="overline">Privacy information</p><h1 className="display-heading">A ticket system without a central face database</h1><p>Focaccia stores the personal and operational records needed to issue and audit tickets. It separates those records from local biometric enrollment.</p></div>
      <div className="privacy-grid fade-section fade-delay-1">
        <section><h2>Stored for your ticket</h2><ul><li>Your Supabase account email.</li><li>Your attendee profile name.</li><li>The event, ticket type, status, and audit timestamps.</li><li>A protected claim-code representation and the recoverable code shown only to its authenticated owner.</li></ul></section>
        <section><h2>Never stored centrally</h2><ul><li>Raw face images or video.</li><li>Reusable face embeddings.</li><li>Cancelable biometric templates in decrypted form.</li><li>Full signed pass tokens or gate private keys.</li></ul></section>
        <section><h2>What happens during enrollment</h2><p>After checkout, the separate iOS enrollment app asks for consent before camera capture. Face processing stays on the attendee device. Native camera capture may create a temporary file, which the app deletes best-effort after local inference. The resulting event-scoped template is encrypted for the gate device before pass issuance.</p></section>
        <section><h2>Cancellation and retention</h2><p>Claimed or enrolled tickets can be cancelled. Cancelling an enrolled ticket revokes its pass. Ticket and non-biometric audit records are retained for EPQ evidence, including terminal cancelled, revoked, and checked-in states.</p></section>
      </div>
      <Alert className="privacy-callout fade-section fade-delay-2"><ShieldAlert /><AlertTitle>Offline revocation limitation</AlertTitle><AlertDescription>A disconnected gate can only enforce the latest revocation list it successfully refreshed. Focaccia does not claim instant revocation while a gate is offline.</AlertDescription></Alert>
      <Button asChild><Link href="/">Return to events</Link></Button>
    </main>
  );
}
