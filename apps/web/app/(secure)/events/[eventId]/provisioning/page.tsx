import type { Metadata } from "next";

import { EventHeader } from "@/components/dashboard/event-header";
import { GateProvisioningListener } from "@/components/dashboard/gate-provisioning-listener";
import { GateProvisioningView } from "@/components/dashboard/gate-provisioning-view";
import { ProvisioningQrCard } from "@/components/dashboard/provisioning-qr-card";
import { PublicValue } from "@/components/dashboard/public-value";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { getProvisionedGates } from "@/lib/dashboard-adapters";
import { getEventDetail } from "@/lib/data";
import { getEventLifecycleState } from "@/lib/event-lifecycle";
import { buildProvisioningPayload, createProvisioningQrValue } from "@/lib/provisioning";

export const metadata: Metadata = { title: "Gate setup" };

export default async function ProvisioningPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { event, logs, revocations } = await getEventDetail(eventId);
  const lifecycle = getEventLifecycleState(event);
  const provisioningPayload = buildProvisioningPayload(event);
  const provisionedGates = getProvisionedGates(event);
  const qrValue = createProvisioningQrValue(event);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <EventHeader counts={{ "/logs": logs.length, "/revocations": revocations.length }} event={event} />
      <div className="grid grid-cols-1 items-start gap-4 px-4 lg:px-6 @4xl/main:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <ProvisioningQrCard isClosed={lifecycle.phase === "ended"} isProvisioned={Boolean(event.pk_gate_event)} qrValue={qrValue} />

        <div className="flex flex-col gap-4" id="qr-payload">
          <GateProvisioningView gates={provisionedGates} />
          <Card className="py-0">
            <CardContent className="px-4">
              <Accordion collapsible type="single">
                <AccordionItem className="border-none" value="cryptographic-details">
                  <AccordionTrigger>Advanced details</AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-4">
                    <FieldGroup className="gap-3">
                      <PublicValue label="PK_SIGN_EVENT" value={event.pk_sign_event} />
                      <PublicValue label="EVENT_SALT" value={event.event_salt} />
                      {event.pk_gate_event ? <PublicValue label="PK_GATE_EVENT" value={event.pk_gate_event} /> : null}
                    </FieldGroup>
                    <pre aria-label="Provisioning payload" className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                      {JSON.stringify(provisioningPayload, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
      <GateProvisioningListener eventId={event.event_id} />
    </div>
  );
}
