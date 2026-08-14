import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  return (
    <main className="page-shell prose-page inspection-page" id="main-content">
      <div className="prose-heading fade-section"><p className="ledger-caption">DATA BOUNDARY ATELIER</p><h1>What Focaccia knows,<br />and what it never receives.</h1><p>A signed pass proves one entry. It does not turn your face into a reusable identity held by a server.</p></div>
      <div className="privacy-boundary fade-section fade-delay-1">
        <section className="privacy-issued"><span>FOCACCIA ISSUES</span><h2>Ticket and revocation records</h2><p>Account ownership, event admission, lifecycle state, and audit timestamps.</p></section>
        <section className="privacy-never"><span>NEVER RECEIVED</span><strong>FACE DATA</strong><p>Raw images, video, and reusable embeddings remain outside Supabase.</p></section>
      </div>
      <div className="privacy-grid fade-section fade-delay-1">
        <section><span>Recorded by this app</span><ul><li>Your Supabase account email and attendee name.</li><li>The event, ticket type, status, and audit timestamps.</li><li>A protected claim-code representation and owner-only recovery.</li></ul></section>
        <section><span>Never put in Supabase</span><ul><li>Raw face images or video.</li><li>Reusable face embeddings.</li><li>Decrypted cancelable biometric templates.</li><li>Full signed pass tokens or gate private keys.</li></ul></section>
      </div>
      <section className="privacy-process" aria-labelledby="privacy-process-title">
        <h2 id="privacy-process-title">How the proof crosses the boundary</h2>
        <div><span>01</span><strong>Buy or claim</strong><p>The ticket is created for the authenticated attendee account.</p></div>
        <div><span>02</span><strong>Process locally</strong><p>The iPhone asks for consent and processes capture on the device.</p></div>
        <div><span>03</span><strong>Issue one pass</strong><p>The event-scoped template is encrypted for the gate before issuance.</p></div>
        <div><span>04</span><strong>Retain the record</strong><p>Terminal ticket and non-biometric audit records remain for EPQ evidence.</p></div>
      </section>
      <Alert className="privacy-callout fade-section fade-delay-2"><ShieldAlert /><AlertTitle>Offline revocation limitation</AlertTitle><AlertDescription>A disconnected gate can only enforce the latest revocation list it successfully refreshed. Focaccia does not claim instant revocation while a gate is offline.</AlertDescription></Alert>
      <Button asChild><Link href="/">Return to events</Link></Button>
    </main>
  );
}
