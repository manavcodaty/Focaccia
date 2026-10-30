"use client";

import type { CSSProperties, ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { EventLifecyclePhase } from "@/lib/event-lifecycle";

export interface ShellEvent {
  event_id: string;
  name: string;
  phase: EventLifecyclePhase;
}

/** Organizer shell, adapted from the shadcn dashboard-01 block. */
export function AppShell({ children, events }: { children: ReactNode; events: ShellEvent[] }) {
  return (
    <SidebarProvider
      style={
        {
          "--header-height": "calc(var(--spacing) * 16)",
          "--sidebar-width": "calc(var(--spacing) * 64)",
        } as CSSProperties
      }
    >
      <Button asChild className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50">
        <a href="#main-content">Skip to main content</a>
      </Button>
      <AppSidebar events={events} variant="inset" />
      <SidebarInset>
        <SiteHeader events={events} />
        <div className="@container/main flex flex-1 flex-col outline-none" id="main-content" tabIndex={-1}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
