import Link from "next/link";
import { ArrowLeft, ShieldCheck, ShieldEllipsis } from "lucide-react";

import { PublicValue } from "@/components/dashboard/public-value";
import { ProvisioningQrCard } from "@/components/dashboard/provisioning-qr-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEventDetail } from "@/lib/data";
import { buildProvisioningPayload, createProvisioningQrValue } from "@/lib/provisioning";

export default async function ProvisioningPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { event } = await getEventDetail(eventId);
  const provisioningPayload = buildProvisioningPayload(event);
  const qrValue = createProvisioningQrValue(event);

  return (
    <div className="space-y-8">
      <section className="fade-section flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <Button asChild variant="ghost">
            <Link href={`/events/${event.event_id}`}>
              <ArrowLeft className="size-4" />
              Back to event overview
            </Link>
          </Button>
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              Gate provisioning
            </div>
            <h1 className="poster-title mt-3 text-5xl leading-none text-[color:var(--foreground)]">
              {event.name}
            </h1>
          </div>
        </div>
        <Badge variant={event.pk_gate_event ? "success" : "warning"}>
          {event.pk_gate_event ? "Gate already provisioned" : "Ready for first gate"}
        </Badge>
      </section>

      <section className="fade-section fade-delay-1 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {event.pk_gate_event ? (
                  <ShieldCheck className="size-5 text-emerald-600" />
                ) : (
                  <ShieldEllipsis className="size-5 text-[color:var(--primary)]" />
                )}
                Provisioning instructions
              </CardTitle>
              <CardDescription>
                The gate app will scan this payload, generate its X25519 keypair locally, call the provisioning function, and then cache the offline verification bundle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-[color:var(--foreground)]">
              <ol className="space-y-2">
                <li>1. Open the Gate App on the single device that will control entry.</li>
                <li>2. Navigate to provisioning and scan the QR shown on this page.</li>
                <li>3. Let the gate register its public encryption key with the server.</li>
                <li>4. Confirm the offline bundle is stored before moving to live scanning.</li>
              </ol>
              <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--accent)] p-4 text-[color:var(--muted-foreground)]">
                This QR intentionally contains only public event configuration. The gate’s private key is generated on the phone and never leaves secure local storage.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Public values</CardTitle>
              <CardDescription>
                These are the exact values the gate needs for offline signature verification and template derivation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PublicValue label="PK_SIGN_EVENT" value={event.pk_sign_event} />
              <PublicValue label="EVENT_SALT" value={event.event_salt} />
              {event.pk_gate_event ? (
                <PublicValue label="PK_GATE_EVENT" value={event.pk_gate_event} />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ProvisioningQrCard
            isProvisioned={Boolean(event.pk_gate_event)}
            payloadLabel={`event:${provisioningPayload.event_id}`}
            qrValue={qrValue}
          />
          <Card>
            <CardHeader>
              <CardTitle>Payload preview</CardTitle>
              <CardDescription>
                This is the public configuration bundle encoded into the QR. It is event-scoped and safe to display.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)]/70 p-5 font-mono text-xs leading-6 text-[color:var(--foreground)]">
                {JSON.stringify(provisioningPayload, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
