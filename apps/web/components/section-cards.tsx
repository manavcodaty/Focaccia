import type { ReactNode } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface SectionCardItem {
  label: string;
  suffix?: ReactNode;
  value: ReactNode;
}

/** KPI row from the shadcn dashboard-01 block, reduced to label and figure. */
export function SectionCards({ items, label }: { items: SectionCardItem[]; label: string }) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-2 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @5xl/main:grid-cols-4"
    >
      {items.map((item) => (
        <Card className="@container/card" key={item.label}>
          <CardHeader className="gap-2">
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {item.value}
              {item.suffix ? <span className="ml-1 text-base font-normal text-muted-foreground">{item.suffix}</span> : null}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </section>
  );
}
