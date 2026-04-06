"use client"

import * as React from "react"
import {
  IconKey,
  IconLayoutDashboard,
  IconPlus,
  IconSettings,
  IconHelp,
  IconShieldCheck,
  IconShieldX,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// ---------------------------------------------------------------------------
// Mock user — replace with real auth context when backend is wired up
// ---------------------------------------------------------------------------
const MOCK_USER = {
  name: "Alex Rivera",
  email: "alex@focaccia.io",
  avatar: "",
}

// ---------------------------------------------------------------------------
// Navigation items — icons map each view
// ---------------------------------------------------------------------------
const NAV_MAIN = [
  {
    title: "Dashboard",
    url: "/",
    icon: IconLayoutDashboard,
  },
  {
    title: "Create Event",
    url: "/events/create",
    icon: IconPlus,
  },
  {
    title: "Gate Provisioning",
    url: "/events/gate-provisioning",
    icon: IconKey,
  },
  {
    title: "Revocations & Logs",
    url: "/events/logs",
    icon: IconShieldX,
  },
]

const NAV_SECONDARY = [
  {
    title: "Settings",
    url: "/settings",
    icon: IconSettings,
  },
  {
    title: "Help",
    url: "/help",
    icon: IconHelp,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Brand logo + name */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/">
                <IconShieldCheck className="size-5! text-primary" />
                <span className="text-base font-semibold tracking-tight">
                  Focaccia
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={NAV_MAIN} />
        <NavSecondary items={NAV_SECONDARY} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={MOCK_USER} />
      </SidebarFooter>
    </Sidebar>
  )
}
