"use client";

import { LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { PrivatePassMark } from "@/components/brand";
import type { ShellEvent } from "@/components/layout/app-shell";
import { NavEvents } from "@/components/nav-events";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({
  events,
  ...props
}: React.ComponentProps<typeof Sidebar> & { events: ShellEvent[] }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!" size="lg">
              <Link href="/dashboard">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <PrivatePassMark className="size-4.5!" />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">PrivatePass</span>
                  <span className="truncate text-xs text-muted-foreground">Organizer</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={[{ icon: <LayoutDashboardIcon />, title: "Overview", url: "/dashboard" }]} />
        <NavEvents events={events} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
