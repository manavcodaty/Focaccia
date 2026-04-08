"use client";

import { Info, ScanLine } from "lucide-react";
import QRCode from "react-qr-code";

import { CopyButton } from "@/components/dashboard/copy-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProvisioningQrCard({
  isClosed,
  isProvisioned,
  payloadLabel,
  qrValue,
}: {
  isClosed?: boolean;
  isProvisioned: boolean;
  payloadLabel: string;
  qrValue: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="size-4" />
              Gate transfer payload
            </CardTitle>
            <CardDescription>
              {isClosed
                ? "The event has ended, so the transfer payload is no longer valid for new gate binding."
                : "Scan from the Gate App provisioning screen. The payload contains only event-scoped public material."}
            </CardDescription>
          </div>
          <Badge variant={isClosed ? "warning" : isProvisioned ? "success" : "warning"}>
            {isClosed ? "Closed" : isProvisioned ? "Bound" : "Awaiting scan"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isClosed ? (
          <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/25 p-6 text-center">
            <Badge variant="warning">Provisioning closed</Badge>
            <p className="mt-4 max-w-md text-sm leading-7 text-[color:var(--foreground)]">
              This event window has ended. Keep the page for audit reference only; the payload cannot be used to
              bind a new gate anymore.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="qr">
            <TabsList>
              <TabsTrigger value="qr">QR payload</TabsTrigger>
              <TabsTrigger value="raw">Raw payload</TabsTrigger>
            </TabsList>

            <TabsContent value="qr">
              <div className="scan-grid relative flex min-h-[22rem] flex-col items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/25 p-6">
                <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_top,rgba(0,102,255,0.08),transparent_50%)]" />
                <div className="relative rounded-xl border border-[color:var(--border)] bg-white p-3.5 shadow-[var(--shadow-elevated)]">
                  <QRCode size={220} value={qrValue} />
                </div>
                <p className="relative mt-4 max-w-md text-center text-[0.8125rem] leading-relaxed text-[color:var(--muted-foreground)]">
                  Once the device scans and registers its key, the event is permanently gate-bound.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="raw">
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant="outline">{payloadLabel}</Badge>
                  <CopyButton label="Provisioning payload copied." value={qrValue} />
                </div>
                <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/25 p-3">
                  <pre className="token-mono overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-[color:var(--foreground)]">
                    {qrValue}
                  </pre>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-3.5">
          <Info className="mt-0.5 size-4 shrink-0 text-[color:var(--muted-foreground)]" />
          <p className="text-[0.8125rem] leading-relaxed text-[color:var(--muted-foreground)]">
            {isClosed
              ? "Provisioning is locked after the event window ends, even if the QR payload is still visible elsewhere for audit."
              : "Use this QR only on trusted provisioning hardware and only during event setup."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
