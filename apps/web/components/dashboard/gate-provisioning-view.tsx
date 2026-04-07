import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button asChild size="sm" variant="outline">
          <Link href={backHref}>
            <ArrowLeft className="size-3.5" />
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
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/25 p-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">Event</p>
              <p className="mt-1.5 text-sm font-medium text-[color:var(--foreground)]">{eventName}</p>
              <p className="mt-0.5 token-mono text-xs text-[color:var(--muted-foreground)]">{eventId}</p>
            </div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/25 p-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">EVENT_SALT</p>
              <p className="mt-1.5 token-mono break-all text-xs leading-5 text-[color:var(--foreground)]">{eventSalt}</p>
            </div>
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
        <CardContent>
          <div className="flex flex-col gap-3">
            {[
              {
                step: "1",
                text: "Open the Gate App on the intended device and navigate to the provisioning scanner.",
              },
              {
                step: "2",
                text: "Scan the QR payload from this page. The gate device generates its keypair on-device and submits only the public key.",
              },
              {
                step: "3",
                text: "Confirm this page shows the event as provisioned. This event cannot be rebound to a different gate afterwards.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary)]/10 text-xs font-semibold text-[color:var(--primary)]">
                  {item.step}
                </div>
                <p className="text-[0.8125rem] leading-relaxed text-[color:var(--foreground)]">
                  {item.text}
                </p>
              </div>
            ))}
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
                      <p className="mt-0.5 token-mono text-xs text-[color:var(--muted-foreground)]">{gate.id}</p>
                    </div>
                    <Badge variant={gate.isActive ? "success" : "warning"}>
                      {gate.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/25 p-3">
                    <p className="token-mono break-all text-xs leading-5 text-[color:var(--foreground)]">
                      {gate.publicKey}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>
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
        <div className="flex items-start gap-3 rounded-xl border border-[color:var(--success)]/20 bg-[color:var(--success-soft)]/40 p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[color:var(--success)]" />
          <div>
            <p className="text-sm font-medium text-[color:var(--success)]">
              Gate device successfully provisioned
            </p>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-[color:var(--success)]/80">
              Keep this page available for audit reference and proceed with attendee enrollment operations.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
