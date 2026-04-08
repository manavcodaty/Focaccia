import { GateProvisioningView } from "@/components/dashboard/gate-provisioning-view";
import { PublicValue } from "@/components/dashboard/public-value";
import { ProvisioningQrCard } from "@/components/dashboard/provisioning-qr-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProvisionedGates } from "@/lib/dashboard-adapters";
import { getEventDetail } from "@/lib/data";
import { getEventLifecycleState } from "@/lib/event-lifecycle";
import { buildProvisioningPayload, createProvisioningQrValue } from "@/lib/provisioning";

export default async function ProvisioningPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { event } = await getEventDetail(eventId);
  const lifecycle = getEventLifecycleState(event);
  const provisioningPayload = buildProvisioningPayload(event);
  const provisionedGates = getProvisionedGates(event);
  const qrValue = createProvisioningQrValue(event);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <GateProvisioningView
        backHref={`/events/${event.event_id}`}
        eventId={event.event_id}
        eventName={event.name}
        eventSalt={event.event_salt}
        gates={provisionedGates}
        phase={lifecycle.phase}
      />

      <div className="space-y-5" id="qr-payload">
        <Card>
          <CardHeader>
            <CardTitle>Public values</CardTitle>
            <CardDescription>
              These are the exact values the gate needs for offline signature verification and template derivation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PublicValue label="PK_SIGN_EVENT" value={event.pk_sign_event} />
            <PublicValue label="EVENT_SALT" value={event.event_salt} />
            {event.pk_gate_event ? (
              <PublicValue label="PK_GATE_EVENT" value={event.pk_gate_event} />
            ) : null}
          </CardContent>
        </Card>
        <ProvisioningQrCard
          isClosed={lifecycle.phase === "ended"}
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
            <pre className="token-mono overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4 text-xs leading-6 text-[color:var(--foreground)]">
              {JSON.stringify(provisioningPayload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
