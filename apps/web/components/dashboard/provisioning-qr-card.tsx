"use client";

import { QrCode, ScanLine } from "lucide-react";
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
  isProvisioned,
  payloadLabel,
  qrValue,
}: {
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
              <ScanLine />
              Gate transfer payload
            </CardTitle>
            <CardDescription>
              Scan from the Gate App provisioning screen. The payload contains only event-scoped public material.
            </CardDescription>
          </div>
          <Badge variant={isProvisioned ? "success" : "warning"}>
            {isProvisioned ? "Bound" : "Awaiting scan"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="qr">
          <TabsList>
            <TabsTrigger value="qr">QR payload</TabsTrigger>
            <TabsTrigger value="raw">Raw payload</TabsTrigger>
          </TabsList>

          <TabsContent value="qr">
            <div className="scan-grid relative mt-4 flex min-h-[24rem] flex-col items-center justify-center rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--muted)]/45 p-6">
              <div className="absolute inset-0 rounded-[1.5rem] bg-[radial-gradient(circle_at_top,rgba(0,102,255,0.15),transparent_58%)]" />
              <div className="relative rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-[0_24px_60px_-40px_rgba(10,16,36,0.7)]">
                <QRCode size={240} value={qrValue} />
              </div>
              <p className="relative mt-5 max-w-lg text-center text-sm leading-6 text-[color:var(--muted-foreground)]">
                Once the device scans and registers its key, the event is permanently gate-bound.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="raw">
            <div className="mt-4 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant="outline">{payloadLabel}</Badge>
                <CopyButton label="Provisioning payload copied." value={qrValue} />
              </div>
              <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/52 p-3">
                <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-[color:var(--foreground)]">
                  {qrValue}
                </pre>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 p-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          <QrCode className="mt-0.5" />
          Use this QR only on trusted provisioning hardware and only during event setup.
        </div>
      </CardContent>
    </Card>
  );
}
