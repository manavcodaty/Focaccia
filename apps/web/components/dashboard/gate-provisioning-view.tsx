import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";

import type { ProvisionedGateSummary } from "@/lib/dashboard-adapters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export interface GateProvisioningViewProps {
  backHref: string;
  eventId: string;
  eventName: string;
  eventSalt: string;
  gates: ProvisionedGateSummary[];
}

export function GateProvisioningView({
  backHref,
  eventId,
  eventName,
  eventSalt,
  gates,
}: GateProvisioningViewProps) {
  const isProvisioned = gates.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant="outline">
          <Link href={backHref}>
            <ArrowLeft data-icon="inline-start" />
            Back to event
          </Link>
        </Button>
        <Badge variant={isProvisioned ? "success" : "warning"}>
          {isProvisioned ? "Gate provisioned" : "Awaiting gate"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provisioning control panel</CardTitle>
          <CardDescription>
            Bind one gate phone to this event. The first successful provisioning call sets the permanent event gate key.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/45 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Event</p>
            <p className="mt-2 text-base font-medium text-[color:var(--foreground)]">{eventName}</p>
            <p className="mt-1 font-mono text-xs text-[color:var(--muted-foreground)]">{eventId}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/45 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">EVENT_SALT</p>
            <p className="mt-2 break-all font-mono text-xs text-[color:var(--foreground)]">{eventSalt}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provision Gate Instructions</CardTitle>
          <CardDescription>
            Follow this exact sequence to avoid locking the event to an unintended device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">Step 1</p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--foreground)]">
              Open the Gate App on the intended device and navigate to the provisioning scanner.
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">Step 2</p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--foreground)]">
              Scan the QR payload from this page. The gate device generates its keypair on-device and submits only the public key.
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">Step 3</p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--foreground)]">
              Confirm this page shows the event as provisioned. This event cannot be rebound to a different gate afterwards.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provisioned devices</CardTitle>
          <CardDescription>
            Gate binding is single-device. If a key is present, this event is considered operationally bound.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gates.length > 0 ? (
            <div className="flex flex-col gap-3">
              {gates.map((gate) => (
                <div
                  key={gate.id}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--foreground)]">{gate.name}</p>
                      <p className="mt-1 font-mono text-xs text-[color:var(--muted-foreground)]">{gate.id}</p>
                    </div>
                    <Badge variant={gate.isActive ? "success" : "danger"}>
                      {gate.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-3 break-all rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/55 p-3 font-mono text-xs text-[color:var(--foreground)]">
                    {gate.publicKey}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty className="border-[color:var(--border)] bg-[color:var(--muted)]/35 p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldAlert />
                </EmptyMedia>
                <EmptyTitle>No gate bound yet</EmptyTitle>
                <EmptyDescription>
                  Complete the QR flow to bind the first gate device for this event.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {isProvisioned ? (
        <div className="rounded-xl border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/55 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--success)]">
            <CheckCircle2 />
            Gate device successfully provisioned
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--success)]">
            Keep this page available for audit reference and proceed with attendee enrollment operations.
          </p>
        </div>
      ) : null}
    </div>
  );
}
