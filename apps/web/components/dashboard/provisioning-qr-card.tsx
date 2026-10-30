"use client";

import { LockIcon } from "lucide-react";
import QRCode from "react-qr-code";

import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const steps = ["Open PrivatePass Gate", "Scan this code", "Refresh revocations before doors"];

export function ProvisioningQrCard({
  isClosed,
  isProvisioned,
  qrValue,
}: {
  isClosed?: boolean;
  isProvisioned: boolean;
  qrValue: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provisioning</CardTitle>
        <CardAction>
          {isClosed ? (
            <span className="text-sm">Closed</span>
          ) : isProvisioned ? (
            <span className="text-sm">Bound</span>
          ) : (
            <span className="text-sm">Awaiting scan</span>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {isClosed ? (
          <Empty className="min-h-72 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon"><LockIcon /></EmptyMedia>
              <EmptyTitle>Event ended</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex items-center justify-center rounded-lg border bg-muted/40 p-6">
            {/* QR codes need a light quiet zone to scan reliably, in either theme. */}
            <div className="rounded-md bg-white p-3">
              <QRCode aria-label="Gate provisioning QR code" bgColor="#ffffff" fgColor="#0a0a0a" role="img" size={208} value={qrValue} />
            </div>
          </div>
        )}
      </CardContent>
      {!isClosed && !isProvisioned ? (
        <CardFooter>
          <ol className="flex flex-col gap-2 text-sm">
            {steps.map((step, index) => (
              <li className="flex items-center gap-3" key={step}>
                <span aria-hidden="true" className="text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </CardFooter>
      ) : null}
    </Card>
  );
}
