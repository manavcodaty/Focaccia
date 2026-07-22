import { GateProvisioningListener } from "@/components/dashboard/gate-provisioning-listener";
import { GateProvisioningView } from "@/components/dashboard/gate-provisioning-view";
import { PublicValue } from "@/components/dashboard/public-value";
import { ProvisioningQrCard } from "@/components/dashboard/provisioning-qr-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
        gates={provisionedGates}
        phase={lifecycle.phase}
      />

      <div className="space-y-5" id="qr-payload">
        <ProvisioningQrCard
          isClosed={lifecycle.phase === "ended"}
          isProvisioned={Boolean(event.pk_gate_event)}
          qrValue={qrValue}
        />
        <Accordion collapsible type="single">
          <AccordionItem value="cryptographic-details">
            <AccordionTrigger className="items-center px-5 py-4 hover:no-underline">
              <span className="pr-4">
                <span className="block text-sm font-semibold text-[color:var(--foreground)]">Advanced cryptographic details</span>
                <span className="mt-1 block text-xs font-normal leading-5 text-[color:var(--muted-foreground)]">
                  Public keys, event salt, and the raw event-scoped transfer payload.
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 px-1">
              <section aria-labelledby="public-values-heading">
                <h2 className="text-sm font-semibold text-[color:var(--foreground)]" id="public-values-heading">Public values</h2>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  The gate uses these values for offline signature verification and template derivation.
                </p>
                <div className="mt-3 space-y-3">
                  <PublicValue label="PK_SIGN_EVENT" value={event.pk_sign_event} />
                  <PublicValue label="EVENT_SALT" value={event.event_salt} />
                  {event.pk_gate_event ? <PublicValue label="PK_GATE_EVENT" value={event.pk_gate_event} /> : null}
                </div>
              </section>
              <section aria-labelledby="payload-preview-heading" className="border-t border-[color:var(--border)] pt-5">
                <h2 className="text-sm font-semibold text-[color:var(--foreground)]" id="payload-preview-heading">Payload preview</h2>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  This public configuration bundle is encoded into the provisioning QR.
                </p>
                <pre className="token-mono mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-[12px] border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4 text-xs leading-6 text-[color:var(--foreground)]">
                  {JSON.stringify(provisioningPayload, null, 2)}
                </pre>
              </section>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <GateProvisioningListener eventId={event.event_id} />
    </div>
  );
}
