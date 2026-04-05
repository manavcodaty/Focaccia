"use client";

import QRCode from "react-qr-code";
import { ScanLine } from "lucide-react";

import { CopyButton } from "@/components/dashboard/copy-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProvisioningQrCard({
  isProvisioned,
  payloadLabel,
  qrValue,
}: {
  isProvisioned: boolean;
  payloadLabel: string;
  qrValue: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[color:var(--border)]/80 pb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-3">
              <ScanLine className="size-5 text-[color:var(--primary)]" />
              Gate provisioning transfer
            </CardTitle>
            <CardDescription>
              The QR carries only event-scoped public configuration so the gate phone can bind itself to this event.
            </CardDescription>
          </div>
          <Badge variant={isProvisioned ? "success" : "warning"}>
            {isProvisioned ? "Gate already bound" : "Awaiting first gate"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs defaultValue="qr">
          <TabsList>
            <TabsTrigger value="qr">QR payload</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="qr">
            <div className="scan-grid relative mt-6 flex min-h-[26rem] flex-col items-center justify-center rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-6">
              <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(0,102,255,0.12),_transparent_55%)]" />
              <div className="relative rounded-[2rem] border border-[color:var(--border)] bg-white p-5 shadow-[0_26px_90px_-42px_rgba(31,24,18,0.6)]">
                <QRCode size={240} value={qrValue} />
              </div>
              <p className="relative mt-6 max-w-md text-center text-sm leading-6 text-[color:var(--muted-foreground)]">
                Scan from the Gate App provisioning screen. Once the gate generates its X25519 keypair,
                it will register the single allowed device for this event.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="raw">
            <div className="mt-6 space-y-4 rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--background)]/75 p-5">
              <div className="flex items-center justify-between gap-4">
                <Badge variant="outline">{payloadLabel}</Badge>
                <CopyButton label="Provisioning payload copied." value={qrValue} />
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-[color:var(--foreground)]">
                {qrValue}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
