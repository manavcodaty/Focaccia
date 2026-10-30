import { SmartphoneIcon } from "lucide-react";

import type { ProvisionedGateSummary } from "@/lib/dashboard-adapters";
import { formatTimestamp } from "@/lib/format-timestamp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";

export interface GateProvisioningViewProps {
  gates: ProvisionedGateSummary[];
}

export function GateProvisioningView({ gates }: GateProvisioningViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device</CardTitle>
      </CardHeader>
      <CardContent>
        {gates.length > 0 ? (
          <ItemGroup>
            {gates.map((gate) => (
              <Item key={gate.id} variant="outline">
                <ItemMedia variant="icon"><SmartphoneIcon /></ItemMedia>
                <ItemContent>
                  <ItemTitle>{gate.name}</ItemTitle>
                  <ItemDescription className="tabular-nums">{formatTimestamp(gate.createdAt)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-sm">
                    {gate.isActive ? "Active" : "Inactive"}
                  </span>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon"><SmartphoneIcon /></EmptyMedia>
              <EmptyTitle>No device</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
